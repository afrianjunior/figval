import { Effect, Exit, Layer, ManagedRuntime, Runtime, Schema, Scope, Stream, SubscriptionRef } from 'effect';
import { TabId } from '../../domain';
import { makeEffectActions, type PanelActions } from './actions';
import { settle } from './actions-notes';
import { type Ctx, type PanelEnv } from './context';
import { PanelState } from './panel-state';
import { initialState, type ModelState } from './state';
import { startStreams } from './streams';
import { derivePanelState } from './view-model';

export interface PanelSnapshot {
  readonly model: ModelState;
  readonly panel: PanelState;
}

export interface PanelStoreOptions {
  /** Bind to one tab (`?tab=<id>` in test mode) instead of following the active tab. */
  readonly boundTabId?: number;
  /** @deprecated Ignored: the bound tab follows `Tabs.onUpdated` instead of polling. */
  readonly boundTabPollMs?: number;
}

export interface PanelStore {
  readonly getSnapshot: () => PanelSnapshot;
  readonly subscribe: (listener: () => void) => () => void;
  readonly actions: PanelActions;
  /** Resolves once the layers are built and every stream is running. */
  readonly ready: Promise<void>;
  /** Runs an effect on the store's runtime (tests drive TestClock through it). */
  readonly run: <A, E>(effect: Effect.Effect<A, E, PanelEnv>) => Promise<A>;
  readonly dispose: () => Promise<void>;
}

const snapshotOf = (model: ModelState): PanelSnapshot => ({ model, panel: derivePanelState(model) });

export const createPanelStore = <E>(layer: Layer.Layer<PanelEnv, E>, options: PanelStoreOptions = {}): PanelStore => {
  const runtime = ManagedRuntime.make(layer);
  const scope = Effect.runSync(Scope.make());
  const ref = Effect.runSync(SubscriptionRef.make(initialState));
  const ctx: Ctx = {
    ref,
    scope,
    boundTabId: options.boundTabId === undefined ? undefined : Schema.decodeSync(TabId)(options.boundTabId),
    debounces: new Map(),
    deleteTimer: null,
    deletePaused: false,
    flashTimer: null,
  };

  let snapshot = snapshotOf(initialState);
  const listeners = new Set<() => void>();
  let live: Runtime.Runtime<PanelEnv> | null = null;

  // Runs on the built runtime once available, so an action starts synchronously inside the click.
  const run = <A, X>(effect: Effect.Effect<A, X, PanelEnv>): Promise<A> =>
    live === null ? runtime.runPromise(effect) : Runtime.runPromise(live)(effect);

  const publish = Stream.runForEach(ref.changes, (model) =>
    Effect.sync(() => {
      snapshot = snapshotOf(model);
      listeners.forEach((l) => l());
    }),
  );

  const ready = runtime.runtime().then(async (rt) => {
    live = rt;
    await Runtime.runPromise(rt)(
      Effect.forkIn(publish, scope).pipe(Effect.zipRight(startStreams(ctx))),
    );
  });

  const effects = makeEffectActions(ctx);
  const actions = Object.fromEntries(
    Object.entries(effects).map(([name, f]) => [
      name,
      (...args: unknown[]) => run((f as (...a: unknown[]) => Effect.Effect<void, never, PanelEnv>)(...args)),
    ]),
  ) as PanelActions;

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    actions,
    ready,
    run,
    dispose: async () => {
      await ready.catch(() => undefined);
      await run(settle(ctx)).catch(() => undefined);
      await Effect.runPromise(Scope.close(scope, Exit.void));
      await runtime.dispose();
    },
  };
};
