import { Effect, Fiber } from 'effect';
import { Messenger } from '../../messaging';
import type { NoteId, NotePatch, Session } from '../../domain';
import {
  NOTE_DEBOUNCE_MS,
  UNDO_WINDOW_MS,
  clearError,
  failTo,
  getState,
  nowMs,
  update,
  type Ctx,
  type PanelEnv,
} from './context';
import { mergeOrder } from './selection';
import { activeSessionOf, toggled, withUi, withoutError } from './state';

const sendPending = (ctx: Ctx, id: NoteId): Effect.Effect<void, never, Messenger> =>
  Effect.gen(function* () {
    const pending = ctx.debounces.get(id);
    if (pending === undefined) return;
    ctx.debounces.delete(id);
    const messenger = yield* Messenger;
    yield* messenger.toBackground({ _tag: 'NoteUpdate', id, patch: pending.patch });
    yield* clearError(ctx, `note:${id}`);
  }).pipe(Effect.catchAll(failTo(ctx, `note:${id}`)));

/** Detail edits autosave: patches for one note merge and go out 400 ms after the last change. */
export const updateNote = (ctx: Ctx, id: NoteId, patch: NotePatch): Effect.Effect<void, never, PanelEnv> =>
  Effect.gen(function* () {
    const previous = ctx.debounces.get(id);
    if (previous !== undefined) yield* Fiber.interrupt(previous.fiber);
    const fiber = yield* Effect.sleep(NOTE_DEBOUNCE_MS).pipe(
      Effect.zipRight(sendPending(ctx, id)),
      Effect.forkIn(ctx.scope),
    );
    ctx.debounces.set(id, { patch: { ...previous?.patch, ...patch }, fiber });
  });

export const flushNote = (ctx: Ctx, id: NoteId): Effect.Effect<void, never, Messenger> =>
  Effect.gen(function* () {
    const pending = ctx.debounces.get(id);
    if (pending === undefined) return;
    yield* Fiber.interrupt(pending.fiber);
    yield* sendPending(ctx, id);
  });

export const flushAllNotes = (ctx: Ctx): Effect.Effect<void, never, Messenger> =>
  Effect.forEach([...ctx.debounces.keys()], (id) => flushNote(ctx, id), { discard: true });

/** Drops a note's waiting autosave so it cannot reach the background after the delete. */
const cancelDebounce = (ctx: Ctx, id: NoteId): Effect.Effect<void> =>
  Effect.gen(function* () {
    const pending = ctx.debounces.get(id);
    if (pending === undefined) return;
    ctx.debounces.delete(id);
    yield* Fiber.interrupt(pending.fiber);
  });

const commitDelete = (ctx: Ctx, id: NoteId): Effect.Effect<void, never, Messenger> =>
  Effect.gen(function* () {
    ctx.deleteTimer = null;
    ctx.deletePaused = false;
    yield* cancelDebounce(ctx, id);
    const messenger = yield* Messenger;
    yield* messenger.toBackground({ _tag: 'NoteDelete', id });
  }).pipe(
    Effect.catchAll((e) => failTo(ctx, 'delete')(e)),
    Effect.ensuring(
      update(ctx, (s) => (s.ui.pendingDelete?.id === id ? withUi(s, { pendingDelete: null }) : s)),
    ),
  );

const startDeleteTimer = (ctx: Ctx, id: NoteId): Effect.Effect<void, never, Messenger> =>
  Effect.gen(function* () {
    ctx.deleteTimer = yield* Effect.sleep(UNDO_WINDOW_MS).pipe(
      Effect.zipRight(commitDelete(ctx, id)),
      Effect.forkIn(ctx.scope),
    );
  });

/** True while a delete waits on its Undo window, running or paused. */
const isUndoOpen = (ctx: Ctx): boolean => ctx.deleteTimer !== null || ctx.deletePaused;

/** Sends the delete that is waiting on its Undo timer (running or paused), now. */
export const commitPendingDelete = (ctx: Ctx): Effect.Effect<void, never, Messenger> =>
  Effect.gen(function* () {
    const pending = (yield* getState(ctx)).ui.pendingDelete;
    if (pending === null || !isUndoOpen(ctx)) return;
    const timer = ctx.deleteTimer;
    if (timer !== null) yield* Fiber.interrupt(timer);
    yield* commitDelete(ctx, pending.id);
  });

/** Hides the note at once and deletes for real after the 5 s Undo window. */
export const deleteNote = (ctx: Ctx, id: NoteId): Effect.Effect<void, never, PanelEnv> =>
  Effect.gen(function* () {
    yield* commitPendingDelete(ctx);
    yield* cancelDebounce(ctx, id);
    const now = yield* nowMs;
    yield* update(ctx, (s) =>
      withUi(withoutError(s, 'delete'), {
        pendingDelete: { id, until: now + UNDO_WINDOW_MS },
        selectedIds: s.ui.selectedIds.has(id) ? toggled(s.ui.selectedIds, id) : s.ui.selectedIds,
        ...(s.ui.detailId === id ? { view: 'list' as const, detailId: null } : {}),
      }),
    );
    yield* startDeleteTimer(ctx, id);
  });

export const undoDelete = (ctx: Ctx): Effect.Effect<void> =>
  Effect.gen(function* () {
    if (!isUndoOpen(ctx)) return;
    const timer = ctx.deleteTimer;
    ctx.deleteTimer = null;
    ctx.deletePaused = false;
    if (timer !== null) yield* Fiber.interrupt(timer);
    yield* update(ctx, (s) => withUi(s, { pendingDelete: null }));
  });

/** Holds the Undo timer (toast hovered or focused) without committing the delete. */
export const pauseUndo = (ctx: Ctx): Effect.Effect<void> =>
  Effect.gen(function* () {
    const timer = ctx.deleteTimer;
    if (timer === null) return;
    ctx.deleteTimer = null;
    ctx.deletePaused = true;
    yield* Fiber.interrupt(timer);
  });

/** Restarts the Undo timer with the full window after a pause. */
export const resumeUndo = (ctx: Ctx): Effect.Effect<void, never, PanelEnv> =>
  Effect.gen(function* () {
    if (!ctx.deletePaused) return;
    ctx.deletePaused = false;
    const pending = (yield* getState(ctx)).ui.pendingDelete;
    if (pending === null) return;
    const now = yield* nowMs;
    yield* update(ctx, (s) =>
      s.ui.pendingDelete === null ? s : withUi(s, { pendingDelete: { id: pending.id, until: now + UNDO_WINDOW_MS } }),
    );
    yield* startDeleteTimer(ctx, pending.id);
  });

const persistOrder = (ctx: Ctx, ids: readonly NoteId[], session: Session) =>
  Effect.gen(function* () {
    const messenger = yield* Messenger;
    yield* messenger.toBackground({
      _tag: 'SessionReorder',
      id: session.id,
      noteOrder: mergeOrder(session.noteOrder, ids),
    });
    yield* update(ctx, (s) => withUi(s, { localOrder: null }));
  });

/** Shows the new order at once, persists it through the background, rolls back if that fails. */
export const reorder = (ctx: Ctx, ids: readonly NoteId[]): Effect.Effect<void, never, Messenger> =>
  Effect.gen(function* () {
    const before = yield* getState(ctx);
    const session = activeSessionOf(before);
    yield* update(ctx, (s) => withUi(withoutError(s, 'reorder'), { localOrder: ids }));
    if (session === null) return;
    yield* persistOrder(ctx, ids, session).pipe(
      Effect.catchAll((e) =>
        update(ctx, (s) => withUi(s, { localOrder: before.ui.localOrder })).pipe(
          Effect.zipRight(failTo(ctx, 'reorder')(e)),
        ),
      ),
    );
  });

export const settle = (ctx: Ctx): Effect.Effect<void, never, Messenger> =>
  flushAllNotes(ctx).pipe(Effect.zipRight(commitPendingDelete(ctx)));
