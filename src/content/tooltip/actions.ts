import { Effect, Exit, Fiber, Scope } from 'effect';
import { hasEdits } from '../../domain';
import { clearDraft } from './drafts';
import { escapeOutcome } from './model/selectors';
import { buildDraft, buildPatch, failureTag, rectOf } from './save';
import type { RestoreAfterClose, SessionCtx } from './session';

export interface Actions {
  readonly cancel: Effect.Effect<void>;
  /** UI Cancel button: ignored while a save is in flight. */
  readonly requestCancel: () => void;
  readonly startSave: () => void;
  /** Header close and Esc: close when clean, otherwise ask once, then discard. */
  readonly requestClose: () => void;
}

/**
 * Closing the scope interrupts the fibers forked in it, which may include the caller
 * (save, UI cancel). A daemon does the closing so the caller is never waiting on itself.
 */
const closeScope = (scope: Scope.CloseableScope): Effect.Effect<void> =>
  Effect.forkDaemon(Scope.close(scope, Exit.void)).pipe(Effect.flatMap(Fiber.join));

/** Closes exactly once: reverts the preview, lets `restore` repaint, drops the draft, returns focus. */
const makeFinish =
  (ctx: SessionCtx) =>
  (restore: RestoreAfterClose): Effect.Effect<void> =>
    Effect.suspend(() => {
      if (ctx.flags.closed) return Effect.void;
      ctx.flags.closed = true;
      ctx.drafts.cancel();
      ctx.previewer.revertAll();
      restore(ctx.boot.note);
      return Effect.all([ctx.textRow.deactivate, clearDraft(ctx.deps.sessionStore, ctx.draftKey)], {
        discard: true,
      }).pipe(
        Effect.zipRight(Effect.sync(() => (ctx.previousFocus as HTMLElement | null)?.focus?.())),
        Effect.zipRight(closeScope(ctx.scope)),
      );
    });

export const makeActions = (ctx: SessionCtx): Actions => {
  const { store, deps, opts, target, doc, boot, ref } = ctx;
  const finish = makeFinish(ctx);

  const cancel = finish((note) => {
    if (note && hasEdits(note)) opts.registry.apply(note.id, ref.el, note.edits);
  });

  const send = Effect.suspend(() => {
    const s = store.get();
    return boot.note
      ? deps.messenger.toBackground({
          _tag: 'NoteUpdate',
          id: boot.note.id,
          patch: buildPatch(s, boot.note),
        })
      : deps.messenger.toBackground({
          _tag: 'NoteCreate',
          draft: buildDraft(s, target, doc),
          rect: rectOf(ref.el),
        });
  });

  const save = send.pipe(
    Effect.flatMap((sent) =>
      finish(() => {
        if (hasEdits(sent)) opts.registry.apply(sent.id, ref.el, sent.edits);
      }),
    ),
    Effect.catchAll((error) =>
      Effect.sync(() => store.dispatch({ type: 'saveFailed', tag: failureTag(error) })),
    ),
  );

  return {
    cancel,
    requestCancel: () => {
      if (!store.get().saving) ctx.fork(cancel);
    },
    startSave: () => {
      if (store.get().saving) return;
      store.dispatch({ type: 'saving' });
      ctx.fork(save);
    },
    requestClose: () => {
      if (store.get().saving) return;
      if (escapeOutcome(store.get()) === 'arm') store.dispatch({ type: 'escape' });
      else ctx.fork(cancel);
    },
  };
};
