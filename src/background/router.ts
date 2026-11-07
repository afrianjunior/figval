import { Effect, Option, Schema, type Context } from 'effect';
import { InvariantViolation, NoteSaveError, TabId } from '../domain';
import {
  Messenger,
  type Handler,
  type HandlerContext,
  type HandlerError,
  type Request,
} from '../messaging';
import { Capture, Clock, Ids, Scripting, Tabs } from '../platform';
import { NoteRepo, SessionRepo, SessionStore, SettingsRepo, ShotStore } from '../storage';
import { ensureActivation } from './activation';
import { missingKey } from './keys';
import { createNote, deleteNote, identityLock, updateNote, type Lock } from './note-service';
import {
  activateSession,
  createSession,
  deleteSession,
  renameSession,
  reorderSession,
  updateSettings,
} from './sessions';

const decodeTabId = Schema.decodeUnknownOption(TabId);

/** Message tab, else the tab that sent it, else the active tab (the sender may not be focused). */
const senderTab = (ctx: HandlerContext): TabId | undefined =>
  Option.getOrUndefined(Option.flatMap(Option.fromNullable(ctx.senderTabId), decodeTabId));

const reportMissing = (req: Extract<Request, { _tag: 'MissingReport' }>, ctx: HandlerContext) =>
  Effect.gen(function* () {
    const active = Option.map(yield* (yield* Tabs).queryActive, (tab) => tab.id);
    const tabId = req.tabId ?? senderTab(ctx) ?? Option.getOrUndefined(active);
    if (tabId === undefined) return;
    yield* (yield* SessionStore).set(missingKey(tabId), req.ids);
  });

/** Everything the background handlers need; main provides it once from BackgroundLive. */
export type HandleEnv =
  | Messenger
  | Tabs
  | Scripting
  | Capture
  | Clock
  | Ids
  | SessionStore
  | SettingsRepo
  | SessionRepo
  | NoteRepo
  | ShotStore;

type Dispatched = Effect.Effect<unknown, { readonly _tag: string }, HandleEnv>;

const dispatch = (req: Request, ctx: HandlerContext, lock: Lock): Dispatched => {
  switch (req._tag) {
    case 'NoteCreate':
      return createNote(req.draft, req.tabId ?? senderTab(ctx), req.rect, lock);
    case 'NoteUpdate':
      return updateNote(req.id, req.patch);
    case 'NoteDelete':
      return deleteNote(req.id);
    case 'SessionCreate':
      return createSession(req.name);
    case 'SessionRename':
      return renameSession(req.id, req.name);
    case 'SessionReorder':
      return reorderSession(req.id, req.noteOrder);
    case 'SessionDelete':
      return deleteSession(req.id);
    case 'SessionActivate':
      return activateSession(req.id);
    case 'SettingsUpdate':
      return updateSettings(req.patch);
    case 'MissingReport':
      return reportMissing(req, ctx);
    case 'ActivateTab':
      return ensureActivation(req.tabId, req.via);
    default:
      // divergent: content-only tags can only arrive through a wiring bug
      return Effect.die(
        new InvariantViolation({ what: `${req._tag} is not a background request` }),
      );
  }
};

/** Consumers see storage tags, not the NoteSaveError wrapper, so the UI maps tag → copy key. */
const toReplyError = (e: { readonly _tag: string }): HandlerError =>
  e instanceof NoteSaveError ? { _tag: e.reason } : { _tag: e._tag };

/** Every background request tag in one place; content-only tags die as InvariantViolation. */
export const handle = (
  req: Request,
  ctx: HandlerContext = {},
  lock: Lock = identityLock,
): Effect.Effect<unknown, HandlerError, HandleEnv> =>
  dispatch(req, ctx, lock).pipe(Effect.mapError(toReplyError));

/** Requests that read-modify-write storage; NoteCreate takes the lock itself, after its capture. */
const SERIALISED = new Set<Request['_tag']>([
  'NoteUpdate',
  'NoteDelete',
  'SessionCreate',
  'SessionRename',
  'SessionReorder',
  'SessionDelete',
  'SessionActivate',
  'SettingsUpdate',
  'MissingReport',
]);

/** One semaphore per background runtime: the single writer applies mutations one at a time. */
export const asHandler = (context: Context.Context<HandleEnv>): Handler => {
  const lock: Lock = Effect.unsafeMakeSemaphore(1).withPermits(1);
  return (req, ctx) =>
    handle(req, ctx, lock).pipe(
      (run) => (SERIALISED.has(req._tag) ? lock(run) : run),
      Effect.provide(context),
    );
};
