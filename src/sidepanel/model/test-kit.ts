import { Effect, Layer, Option } from 'effect';
import { TestContext } from 'effect/TestContext';
import { Schema } from 'effect';
import {
  NoteSeq,
  SessionId,
  TabId,
  emptyEdits,
  type Note,
  type NoteId,
  type Session,
  type Settings,
} from '../../domain';
import {
  Messenger,
  MessengerLoopback,
  type Handler,
  type HandlerError,
  type Request,
} from '../../messaging';
import {
  Ids,
  PlatformTest,
  type PlatformTestConfig,
  type TabInfo,
} from '../../platform';
import { NoteRepo, SessionRepo, SessionStore, SettingsRepo, makeStorageMemory } from '../../storage';
import type { PanelEnv } from './context';
import type { PanelStore } from './store';
import { activationKey } from './streams';

/** Runs an effect that also needs test-only services (TestDriver, TestRecorder) on the store's runtime. */
export const runTest = <A, E, R>(store: PanelStore, effect: Effect.Effect<A, E, R>): Promise<A> =>
  store.run(effect as unknown as Effect.Effect<A, E, PanelEnv>);

export const tid = (n: number): TabId => Schema.decodeSync(TabId)(n);
export const sessionIdOf = (suffix: string): SessionId => Schema.decodeSync(SessionId)(`fv-${suffix}`);
const uuid = (n: number): NoteId =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}` as NoteId;

export const nid = uuid;

export const mkSession = (suffix = 'aaaa', over: Partial<Session> = {}): Session => ({
  schemaVersion: 1,
  id: sessionIdOf(suffix),
  name: `Session ${suffix}`,
  createdAt: 1,
  updatedAt: 1,
  nextSeq: Schema.decodeSync(NoteSeq)(100),
  noteOrder: [],
  ...over,
});

export const mkNote = (n: number, over: Partial<Note> = {}, suffix = 'aaaa'): Note => ({
  schemaVersion: 1,
  id: uuid(n),
  seq: Schema.decodeSync(NoteSeq)(n),
  sessionId: sessionIdOf(suffix),
  createdAt: 1,
  updatedAt: 1,
  page: { url: 'https://example.com/', title: 'Example', viewport: { w: 1440, h: 900 }, dpr: 2 },
  target: {
    kind: 'element',
    label: `Button ${n}`,
    text: 'Go',
    attrs: {},
    classes: [],
    domPath: [],
    selector: 'button',
    html: '<button>Go</button>',
    selection: null,
    state: 'rest',
  },
  comment: '',
  why: '',
  forceApply: false,
  edits: emptyEdits,
  shots: { before: null, after: null },
  ...over,
});

export const mkTab = (id: number, url = 'https://example.com/'): TabInfo => ({
  id: tid(id),
  url,
  title: 'Example',
  windowId: 1,
});

export interface Harness {
  readonly layer: Layer.Layer<PanelEnv>;
  readonly toContent: Request[];
  readonly toBackground: Request[];
  /** Make the next ActivateTab fail with this remote tag. */
  readonly failActivation: { current: string | null };
  readonly failContent: { current: boolean };
  /** Make every background request fail with this remote tag. */
  readonly failBackground: { current: string | null };
}

const fail = (tag: string): HandlerError => ({ _tag: tag });

const backgroundHandler =
  (h: Pick<Harness, 'failActivation'>) =>
  (notes: NoteRepo['Type'], sessions: SessionRepo['Type'], settings: SettingsRepo['Type'], kv: SessionStore['Type'], ids: Ids['Type']): Handler =>
  (req) => {
    const swallow = <A>(e: Effect.Effect<A, unknown>): Effect.Effect<A, HandlerError> =>
      e.pipe(Effect.mapError(() => fail('StorageUnavailable')));
    switch (req._tag) {
      case 'NoteUpdate':
        return swallow(
          Effect.gen(function* () {
            const all = (yield* sessions.list).items;
            for (const s of all) {
              const found = yield* notes.get(s.id, req.id);
              if (Option.isNone(found)) continue;
              const { label, ...rest } = req.patch;
              const next: Note = {
                ...found.value,
                ...rest,
                target: label === undefined ? found.value.target : { ...found.value.target, label },
              };
              yield* notes.replace(next);
              return next;
            }
            return yield* Effect.fail('unknown note');
          }),
        );
      case 'NoteDelete':
        return swallow(
          Effect.gen(function* () {
            for (const s of (yield* sessions.list).items) yield* notes.remove(s.id, req.id);
          }),
        ).pipe(Effect.as(undefined));
      case 'SessionCreate':
        return swallow(
          Effect.gen(function* () {
            const id = yield* ids.sessionId;
            const session = mkSession(id.slice(3), { name: req.name ?? 'New session' });
            yield* sessions.insert(session);
            return session;
          }),
        );
      case 'SessionReorder':
        return swallow(
          Effect.gen(function* () {
            const found = yield* sessions.get(req.id);
            if (Option.isNone(found)) return yield* Effect.fail('unknown session');
            const next = { ...found.value, noteOrder: req.noteOrder };
            yield* sessions.replace(next);
            return next;
          }),
        );
      case 'SessionRename':
        return swallow(
          Effect.gen(function* () {
            const found = yield* sessions.get(req.id);
            if (Option.isNone(found)) return yield* Effect.fail('unknown session');
            const next = { ...found.value, name: req.name };
            yield* sessions.replace(next);
            return next;
          }),
        );
      case 'SessionDelete':
        return swallow(sessions.remove(req.id).pipe(Effect.zipRight(notes.removeAll(req.id)))).pipe(Effect.as(undefined));
      case 'SessionActivate':
        return swallow(
          Effect.gen(function* () {
            const next: Settings = { ...(yield* settings.get), activeSessionId: req.id };
            yield* settings.put(next);
            return next;
          }),
        );
      case 'SettingsUpdate':
        return swallow(
          Effect.gen(function* () {
            const next: Settings = { ...(yield* settings.get), ...req.patch };
            yield* settings.put(next);
            return next;
          }),
        );
      case 'ActivateTab': {
        const failure = h.failActivation.current;
        if (failure !== null) return Effect.fail(fail(failure));
        return swallow(
          kv.set(activationKey(req.tabId), { tabId: req.tabId, origin: 'https://example.com', active: true }),
        ).pipe(Effect.as(undefined));
      }
      default:
        return Effect.fail(fail('InvariantViolation'));
    }
  };

/**
 * Loopback messenger with a small fake background (writes through the memory repos so streams react)
 * and a recording fake content script. W5 replaces this with the real background.
 */
export const makeHarness = (config: PlatformTestConfig = {}): Harness => {
  const toContent: Request[] = [];
  const toBackground: Request[] = [];
  const failActivation = { current: null as string | null };
  const failContent = { current: false };
  const failBackground = { current: null as string | null };

  const base = Layer.mergeAll(PlatformTest(config), makeStorageMemory(), MessengerLoopback);
  const serving = Layer.scopedDiscard(
    Effect.gen(function* () {
      const messenger = yield* Messenger;
      const make = backgroundHandler({ failActivation });
      const handler = make(
        yield* NoteRepo,
        yield* SessionRepo,
        yield* SettingsRepo,
        yield* SessionStore,
        yield* Ids,
      );
      yield* messenger.serve('background', (req) => {
        toBackground.push(req);
        return failBackground.current === null ? handler(req) : Effect.fail(fail(failBackground.current));
      });
      yield* messenger.serve('content', (req) => {
        toContent.push(req);
        return failContent.current ? Effect.fail(fail('ElementNotFound')) : Effect.succeed(undefined);
      });
    }),
  );
  const layer = serving.pipe(Layer.provideMerge(base), Layer.merge(TestContext));
  return { layer: layer as unknown as Layer.Layer<PanelEnv>, toContent, toBackground, failActivation, failContent, failBackground };
};
