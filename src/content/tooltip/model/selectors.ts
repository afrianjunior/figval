import { emptyEdits, hasEdits, type Edits, type StyleProperty } from '../../../domain';
import { toDiff } from '../../edit';
import { snapshotKey, type TooltipState } from './state';

/** Edits the tooltip would save; empty once the element is gone. */
export const diffOf = (s: TooltipState): Edits =>
  s.elementStatus === 'gone' ? emptyEdits : toDiff(s.baseline, s.controls);

export const changedProps = (s: TooltipState): ReadonlySet<StyleProperty> =>
  new Set(diffOf(s).style.map((c) => c.property));

export const styleValue = (s: TooltipState, prop: StyleProperty): string =>
  s.controls.style[prop] ?? s.baseline.style[prop];

export const isDirty = (s: TooltipState): boolean => snapshotKey(s) !== s.initialKey;

export const canSave = (s: TooltipState): boolean =>
  !s.saving && (s.comment.trim() !== '' || hasEdits({ edits: diffOf(s) }));

export const showForceApply = (s: TooltipState): boolean => !hasEdits({ edits: diffOf(s) });

export type EscapeOutcome = 'close' | 'arm' | 'discard';

/** Esc on a clean tooltip closes; on a dirty one it asks once, then discards. */
export const escapeOutcome = (s: TooltipState): EscapeOutcome => {
  if (!isDirty(s)) return 'close';
  return s.escArmed ? 'discard' : 'arm';
};
