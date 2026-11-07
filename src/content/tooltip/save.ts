import type { Note, NoteDraft, NotePatch, Target } from '../../domain';
import { diffOf, showForceApply } from './model/selectors';
import type { TooltipState } from './model/state';

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export const rectOf = (el: Element): Rect => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
};

const fields = (s: TooltipState) => ({
  comment: s.comment.trim(),
  why: s.showWhy ? s.why.trim() : '',
  forceApply: showForceApply(s) ? s.forceApply : false,
  edits: diffOf(s),
});

export const buildDraft = (s: TooltipState, target: Target, doc: Document): NoteDraft => {
  const win = doc.defaultView ?? window;
  return {
    page: {
      url: win.location.href,
      title: doc.title,
      viewport: { w: win.innerWidth, h: win.innerHeight },
      dpr: win.devicePixelRatio,
    },
    target: { ...target, label: s.label.trim() || target.label },
    ...fields(s),
  };
};

export const buildPatch = (s: TooltipState, current: Note): NotePatch => ({
  ...fields(s),
  ...(s.label.trim() !== '' && s.label.trim() !== current.target.label
    ? { label: s.label.trim() }
    : {}),
});

/** Error tag for the save-failure line: remote failures carry the remote tag. */
export const failureTag = (error: { readonly _tag: string; readonly tag?: string }): string =>
  error._tag === 'RemoteFailure' && error.tag ? error.tag : error._tag;
