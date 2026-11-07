import { Effect, Layer, ManagedRuntime, Schema } from 'effect';
import { emptyEdits, ShotStoreError, StorageUnavailable, TabId, type NoteDraft } from '../domain';
import { Messenger, makeMessengerLoopback, type Handler } from '../messaging';
import { PlatformTest, type PlatformTestConfig, type TabInfo } from '../platform';
import {
  makeFaultControl,
  makeMemoryShotStore,
  makeStorageMemory,
  SessionRepo,
  SessionStoreMemory,
  SettingsRepo,
  ShotStore,
  type ShotStoreService,
} from '../storage';
import { asHandler, type HandleEnv } from './router';

export const NOV_7_2026 = Date.UTC(2026, 10, 7, 12);
export const tabIdOf = (n: number): TabId => Schema.decodeSync(TabId)(n);
export const tab = (n: number, url = 'https://example.com/page'): TabInfo => ({
  id: tabIdOf(n),
  url,
  title: 'T',
  windowId: 10,
});

export const draftOf = (overrides: Partial<NoteDraft> = {}): NoteDraft => ({
  page: { url: 'https://example.com/page', title: 'Example', viewport: { w: 800, h: 600 }, dpr: 2 },
  target: {
    kind: 'element',
    label: 'Hero',
    text: 'Start',
    attrs: {},
    classes: [],
    domPath: [],
    selector: '#cta',
    html: '<button>Start</button>',
    selection: null,
    state: 'rest',
  },
  comment: 'bigger',
  why: '',
  forceApply: false,
  edits: emptyEdits,
  ...overrides,
});

export const withTextEdit = (): NoteDraft =>
  draftOf({ edits: { ...emptyEdits, text: { before: 'Start', after: 'Go' } } });

export interface HarnessOptions {
  readonly platform?: PlatformTestConfig;
  /** When false the content script is absent: Ping fails and nothing else is served. */
  readonly contentAlive?: boolean;
  readonly screenshotsOff?: boolean;
  /** Sender tab id the loopback attaches to every message. */
  readonly senderTabId?: number;
}

/** In-process background + fake content; `contentCalls` records the content-bound tags in order. */
export const makeHarness = (options: HarnessOptions = {}) => {
  const contentCalls: string[] = [];
  const fault = makeFaultControl();
  const shotLive = new Set<string>();
  const breakWrites = { sessionReplace: false, settingsPut: false, shotRemoveMany: false };
  const inner: ShotStoreService = makeMemoryShotStore();
  const shotSpy: ShotStoreService = {
    ...inner,
    put: (id, blob) =>
      Effect.tap(inner.put(id, blob), () => Effect.sync(() => void shotLive.add(id))),
    remove: (id) => Effect.tap(inner.remove(id), () => Effect.sync(() => void shotLive.delete(id))),
    removeMany: (ids) =>
      breakWrites.shotRemoveMany
        ? Effect.fail(new ShotStoreError({ op: 'removeMany', cause: 'simulated' }))
        : Effect.tap(inner.removeMany(ids), () =>
            Effect.sync(() => ids.forEach((id) => shotLive.delete(id))),
          ),
  };
  const uiHideGate = { promise: null as Promise<void> | null };
  const failing = { tag: null as string | null };
  const brokenWrite = Effect.fail(new StorageUnavailable({ cause: 'simulated write failure' }));
  const faulty = Layer.effect(
    SessionRepo,
    Effect.map(SessionRepo, (repo) => ({
      ...repo,
      replace: (session: Parameters<typeof repo.replace>[0]) =>
        breakWrites.sessionReplace ? brokenWrite : repo.replace(session),
    })),
  );
  const faultySettings = Layer.effect(
    SettingsRepo,
    Effect.map(SettingsRepo, (repo) => ({
      ...repo,
      put: (settings: Parameters<typeof repo.put>[0]) =>
        breakWrites.settingsPut ? brokenWrite : repo.put(settings),
    })),
  );
  const content: Handler = (req) => {
    contentCalls.push(req._tag);
    if (req._tag === 'UiHide' && uiHideGate.promise !== null) {
      const wait = uiHideGate.promise;
      return Effect.promise(() => wait).pipe(Effect.as(undefined));
    }
    if (req._tag === failing.tag) return Effect.fail({ _tag: 'ContentBroke' });
    if (req._tag === 'Ping') {
      return options.contentAlive === false
        ? Effect.fail({ _tag: 'NoContent' })
        : Effect.succeed({ pong: true });
    }
    return Effect.succeed(undefined);
  };
  const served = Layer.scopedDiscard(
    Effect.gen(function* () {
      const messenger = yield* Messenger;
      yield* messenger.serve('content', content);
      yield* messenger.serve('background', asHandler(yield* Effect.context<HandleEnv>()));
    }),
  );
  const base = Layer.mergeAll(
    makeStorageMemory(fault),
    // divergent: makeStorageMemory does not hand its FaultControl to SessionStoreMemory (see Needs)
    SessionStoreMemory(fault),
    Layer.succeed(ShotStore, shotSpy),
    PlatformTest({ tabs: [tab(1)], activeTabId: tabIdOf(1), now: NOV_7_2026, ...options.platform }),
    makeMessengerLoopback(
      options.senderTabId === undefined ? {} : { senderTabId: options.senderTabId },
    ),
  );
  const wrapped = Layer.provideMerge(Layer.merge(faulty, faultySettings), base);
  const layer = Layer.provideMerge(served, wrapped);
  const runtime = ManagedRuntime.make(layer);
  return {
    runtime,
    run: <A, E>(effect: Effect.Effect<A, E, Layer.Layer.Success<typeof layer>>) =>
      runtime.runPromise(effect),
    contentCalls,
    /** Makes every later UiHide wait until the returned release is called. */
    holdUiHide: (): (() => void) => {
      let release: () => void = () => undefined;
      uiHideGate.promise = new Promise<void>((resolve) => {
        release = () => {
          uiHideGate.promise = null;
          resolve();
        };
      });
      return release;
    },
    fault,
    breakWrites,
    shotLive,
    failContentOn: (tag: string | null) => {
      failing.tag = tag;
    },
  };
};
