import { Effect, Option, type Context } from 'effect';
import { InvariantViolation, NoteSaveError } from '../domain';
import { Messenger, type Handler, type HandlerError, type Request } from '../messaging';
import { Capture, Clock, Ids, Scripting, Tabs } from '../platform';
import { NoteRepo, SessionRepo, SessionStore, SettingsRepo, ShotStore } from '../storage';
import { ensureActivation } from './activation';
import { missingKey } from './keys';
import { createNote, deleteNote, updateNote } from './note-service';
import {
  activateSession,
  createSession,
  deleteSession,
  renameSession,
  reorderSession,
  updateSettings,
} from './sessions';

const reportMissing = (req: Extract<Request, { _tag: 'MissingReport' }>) =>
  Effect.gen(function* () {
    const active = Option.map(yield* (yield* Tabs).queryActive, (tab) => tab.id);
    const tabId = req.tabId ?? Option.getOrUndefined(active);
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

const dispatch = (req: Request): Dispatched => {
  switch (req._tag) {
    case 'NoteCreate':
      return createNote(req.draft, req.tabId, req.rect);
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
      return reportMissing(req);
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
export const handle = (req: Request): Effect.Effect<unknown, HandlerError, HandleEnv> =>
  dispatch(req).pipe(Effect.mapError(toReplyError));

export const asHandler =
  (context: Context.Context<HandleEnv>): Handler =>
  (req) =>
    handle(req).pipe(Effect.provide(context));
