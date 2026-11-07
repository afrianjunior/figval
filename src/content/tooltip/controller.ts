import { Effect, Scope } from 'effect';
import { findSimilar } from '../../locator';
import { computeBaseline } from '../edit';
import { acquireOverlayHost, type TooltipOpenOptions } from '../picker';
import type { Target } from '../../domain';
import { makeActions } from './actions';
import { loadBoot, type Boot } from './boot';
import { makeDraftWriter } from './drafts';
import { startFollow } from './follow';
import { makeMatchHighlighter } from './matches';
import { draftKey, toSnapshot } from './model/draft';
import { isDirty } from './model/selectors';
import { initialState, type TooltipState } from './model/state';
import { defaultTab } from './model/tab';
import { makePreviewer } from './preview';
import { makeFork, type SessionCtx, type TooltipDeps } from './session';
import { makeStore } from './store';
import { makeTextRow } from './textrow';
import { mountView } from './view';
import { watchElement } from './watch';

export type { TooltipDeps } from './session';

export interface TooltipHandle {
  /** Reverts previews, drops the draft and closes. Safe to call twice. */
  readonly cancel: Effect.Effect<void>;
  readonly setHidden: (hidden: boolean) => void;
}

export interface SessionInput {
  readonly deps: TooltipDeps;
  readonly target: Target;
  readonly opts: TooltipOpenOptions;
  readonly resolveAsset: (path: string) => string;
  /** The scope the tooltip lives in; closing it releases everything. */
  readonly scope: Scope.CloseableScope;
}

const startState = (boot: Boot, target: Target, opts: TooltipOpenOptions): TooltipState => {
  const el = opts.anchor;
  const note = boot.note;
  return initialState({
    seq: boot.seq,
    mode: opts.mode,
    tab: defaultTab(boot.settings.preset, boot.settings.lastTooltipTab),
    baseline: computeBaseline(el),
    similar: findSimilar(el, el.ownerDocument),
    label: note?.target.label ?? target.label,
    ...(note
      ? { comment: note.comment, why: note.why, forceApply: note.forceApply, edits: note.edits }
      : {}),
    selectionText: opts.selectionText ?? target.selection?.text ?? null,
    resume: boot.resume ? { seq: boot.resume.seq, snapshot: boot.resume.snapshot } : null,
  });
};

/** Keeps the page preview, the persisted draft and the last-used tab in step with the store. */
const wireStore = (ctx: SessionCtx, rerender: () => void): (() => void) =>
  ctx.store.subscribe((prev, next) => {
    if (ctx.flags.closed) return;
    if (prev.controls !== next.controls || prev.elementStatus !== next.elementStatus) {
      ctx.previewer.apply(next);
    }
    if (prev.tab !== next.tab) {
      ctx.fork(
        ctx.deps.messenger
          .toBackground({ _tag: 'SettingsUpdate', patch: { lastTooltipTab: next.tab } })
          .pipe(Effect.catchAll((e) => Effect.logWarning('figval: tab not saved', e._tag))),
      );
    }
    if (next.resume === null && next.mode === 'new') {
      ctx.drafts.schedule(
        isDirty(next)
          ? { seq: next.seq, selector: ctx.target.selector, snapshot: toSnapshot(next) }
          : null,
      );
    }
    rerender();
  });

/** Opens one tooltip; null when the note to reopen no longer exists. */
export const openSession = (
  input: SessionInput,
): Effect.Effect<TooltipHandle | null, never, Scope.Scope> =>
  Effect.gen(function* () {
    const { deps, target, opts, scope } = input;
    const doc = opts.anchor.ownerDocument;
    const url = (doc.defaultView ?? window).location.href;
    const boot = yield* loadBoot(deps, opts, url, target.selector);
    if (boot === null) return null;
    // The element's saved edits are lifted off so the baseline is its true look.
    if (boot.note) opts.registry.remove(boot.note.id);

    const host = yield* acquireOverlayHost({ doc, resolveAsset: input.resolveAsset });
    const fork = makeFork(scope);
    const ctx: SessionCtx = {
      deps,
      target,
      opts,
      doc,
      boot,
      scope,
      fork,
      draftKey: draftKey(url),
      store: makeStore(startState(boot, target, opts)),
      previewer: makePreviewer(opts.anchor, doc),
      matches: makeMatchHighlighter(host.layer, doc),
      drafts: makeDraftWriter(deps.sessionStore, draftKey(url), fork),
      textRow: yield* makeTextRow(scope),
      previousFocus: doc.activeElement,
      ref: { el: opts.anchor },
      flags: { closed: false },
    };
    const actions = makeActions(ctx);
    const view = mountView(ctx, host, actions);
    ctx.previewer.apply(ctx.store.get());

    const follower = yield* startFollow({
      doc,
      slot: view.slot,
      getAnchor: () => ctx.ref.el,
      onFrame: ctx.matches.refresh,
      onPlacement: (side, offscreen) => {
        view.setPlacement(side, offscreen);
        view.render();
      },
    });
    view.attach(follower);
    view.render(true);
    follower.reposition();

    const unsubscribe = wireStore(ctx, view.render);
    const stopWatch = watchElement(ctx, follower);
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      e.stopPropagation();
      actions.requestClose();
    };
    doc.addEventListener('keydown', onKey);

    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        ctx.flags.closed = true;
        unsubscribe();
        stopWatch();
        doc.removeEventListener('keydown', onKey);
        ctx.matches.hide();
        ctx.drafts.cancel();
        view.unmount();
      }),
    );
    return { cancel: actions.cancel, setHidden: host.setHidden };
  });
