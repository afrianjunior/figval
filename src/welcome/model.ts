import { Duration, Effect, Fiber, Layer, ManagedRuntime, Schedule, Stream, SubscriptionRef } from 'effect';
import { EXAMPLE_PAGE_URL, SHORTCUTS_URL } from '../copy';
import type { Preset } from '../domain';
import { Messenger } from '../messaging';
import { Extension } from '../platform';
import { SessionRepo, SettingsRepo } from '../storage';

export type WelcomeEnv = SettingsRepo | SessionRepo | Messenger | Extension;

export interface WelcomeState {
  readonly loaded: boolean;
  readonly preset: Preset;
  /** True once the user picked a preset on this page; the default alone does not count. */
  readonly presetChosen: boolean;
  readonly pinned: boolean;
  /** Assigned `pick` shortcut; empty when Chrome left it unassigned. */
  readonly shortcut: string;
  readonly saveFailed: boolean;
  /** A session exists, i.e. the user saved a first note somewhere. */
  readonly hasNotes: boolean;
}

export const initialWelcome: WelcomeState = {
  loaded: false,
  preset: 'reviewer',
  presetChosen: false,
  pinned: false,
  shortcut: '',
  saveFailed: false,
  hasNotes: false,
};

export const PICK_COMMAND = 'pick';
const DEFAULT_PIN_POLL_MS = 1500;

export const stepsOf = (s: WelcomeState) => ({
  pin: s.pinned,
  role: s.presetChosen,
  tried: s.hasNotes,
  done: [s.pinned, s.presetChosen, s.hasNotes].filter(Boolean).length,
});

export interface WelcomeActions {
  readonly choosePreset: (preset: Preset) => Promise<void>;
  readonly openExample: () => Promise<void>;
  readonly openShortcuts: () => Promise<void>;
}

export interface WelcomeStore {
  readonly getSnapshot: () => WelcomeState;
  readonly subscribe: (listener: () => void) => () => void;
  readonly actions: WelcomeActions;
  readonly ready: Promise<void>;
  readonly run: <A, E>(effect: Effect.Effect<A, E, WelcomeEnv>) => Promise<A>;
  readonly dispose: () => Promise<void>;
}

export interface WelcomeStoreOptions {
  /** How often to re-check the pinned state until it is pinned (Chrome has no pin event). */
  readonly pinPollMs?: number;
}

type Ref = SubscriptionRef.SubscriptionRef<WelcomeState>;
const patch = (ref: Ref, p: Partial<WelcomeState>) => SubscriptionRef.update(ref, (s) => ({ ...s, ...p }));

const load = (ref: Ref) =>
  Effect.gen(function* () {
    const ext = yield* Extension;
    const [settings, pinned, shortcut] = yield* Effect.all(
      [Effect.flatMap(SettingsRepo, (r) => r.get), ext.isPinned, ext.shortcut(PICK_COMMAND)],
      { concurrency: 'unbounded' },
    );
    yield* patch(ref, { loaded: true, preset: settings.preset, pinned: pinned === true, shortcut });
  });

const followSettings = (ref: Ref) =>
  Stream.unwrap(Effect.map(SettingsRepo, (r) => r.stream)).pipe(
    Stream.runForEach((settings) => patch(ref, { preset: settings.preset })),
  );

/** Step 3 happens on another tab; a first saved note creates a session, which ticks it here. */
const followSessions = (ref: Ref) =>
  Stream.unwrap(Effect.map(SessionRepo, (r) => r.stream)).pipe(
    Stream.runForEach((sessions) => patch(ref, { hasNotes: sessions.length > 0 })),
  );

/** Chrome has no pin event, so poll until pinned; stop when this Chrome cannot report it (null). */
const pollPinned = (ref: Ref, everyMs: number) =>
  Effect.flatMap(Extension, (ext) =>
    ext.isPinned.pipe(
      Effect.tap((pinned) => patch(ref, { pinned: pinned === true })),
      Effect.repeat({ schedule: Schedule.spaced(Duration.millis(everyMs)), until: (pinned) => pinned !== false }),
    ),
  );

const choosePreset = (ref: Ref, preset: Preset) =>
  Effect.flatMap(Messenger, (m) => m.toBackground({ _tag: 'SettingsUpdate', patch: { preset } })).pipe(
    Effect.matchEffect({
      onSuccess: () => patch(ref, { preset, presetChosen: true, saveFailed: false }),
      onFailure: (cause) =>
        Effect.logWarning('preset save failed', cause).pipe(Effect.zipRight(patch(ref, { saveFailed: true }))),
    }),
  );

const open = (url: string) => Effect.flatMap(Extension, (e) => e.openUrl(url));

export const createWelcomeStore = <E>(
  layer: Layer.Layer<WelcomeEnv, E>,
  options: WelcomeStoreOptions = {},
): WelcomeStore => {
  const runtime = ManagedRuntime.make(layer);
  const ref = Effect.runSync(SubscriptionRef.make(initialWelcome));
  let snapshot = initialWelcome;
  const listeners = new Set<() => void>();
  const fibers: Fiber.RuntimeFiber<unknown, unknown>[] = [];
  let disposed = false;

  const publish = Stream.runForEach(ref.changes, (s) =>
    Effect.sync(() => {
      snapshot = s;
      listeners.forEach((l) => l());
    }),
  );

  const run = <A, X>(effect: Effect.Effect<A, X, WelcomeEnv>) => runtime.runPromise(effect);
  // The page can be hidden before loading finishes; nothing may start on a disposed runtime.
  const background = <A, X>(effect: Effect.Effect<A, X, WelcomeEnv>) => {
    if (disposed) return;
    fibers.push(runtime.runFork(effect.pipe(Effect.catchAllCause((c) => Effect.logWarning('welcome stream', c)))));
  };

  background(publish);
  const ready = run(load(ref)).then(
    () => {
      background(followSettings(ref));
      background(followSessions(ref));
      background(pollPinned(ref, options.pinPollMs ?? DEFAULT_PIN_POLL_MS));
    },
    (cause: unknown) => {
      if (!disposed) Effect.runFork(Effect.logWarning('welcome load failed', cause));
    },
  );

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    actions: {
      choosePreset: (preset) => run(choosePreset(ref, preset)),
      openExample: () => run(open(EXAMPLE_PAGE_URL)),
      openShortcuts: () => run(open(SHORTCUTS_URL)),
    },
    ready,
    run,
    dispose: async () => {
      disposed = true;
      await Promise.all(fibers.map((f) => Effect.runPromise(Fiber.interrupt(f))));
      await runtime.dispose();
    },
  };
};
