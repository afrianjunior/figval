import type { Edits, StyleProperty, TooltipTab } from '../../../domain';
import { toDiff, type Baseline, type DraftEdits } from '../../edit';
import type { DraftSnapshot } from './draft';

export type ElementStatus = 'ok' | 'reapplied' | 'gone';

export interface TooltipState {
  readonly seq: number;
  readonly mode: 'new' | 'reopen';
  readonly tab: TooltipTab;
  readonly label: string;
  readonly comment: string;
  readonly why: string;
  readonly showWhy: boolean;
  readonly forceApply: boolean;
  readonly controls: DraftEdits;
  readonly baseline: Baseline;
  /** Snapshot key of the state the tooltip opened with; dirty means it differs. */
  readonly initialKey: string;
  readonly escArmed: boolean;
  readonly saving: boolean;
  /** Error tag from the last failed save. */
  readonly error: string | null;
  readonly elementStatus: ElementStatus;
  readonly selectionText: string | null;
  readonly resume: { readonly seq: number; readonly snapshot: DraftSnapshot } | null;
  /** First-note hint (Comment vs Edit). UI only: never part of the dirty snapshot. */
  readonly showHint: boolean;
}

export interface InitOptions {
  readonly seq: number;
  readonly mode: 'new' | 'reopen';
  readonly tab: TooltipTab;
  readonly baseline: Baseline;
  readonly similar: { readonly selector: string; readonly count: number };
  readonly label?: string;
  readonly comment?: string;
  readonly why?: string;
  readonly forceApply?: boolean;
  readonly edits?: Edits;
  readonly selectionText?: string | null;
  readonly resume?: { readonly seq: number; readonly snapshot: DraftSnapshot } | null;
  readonly showHint?: boolean;
}

export type Action =
  | { readonly type: 'tab'; readonly value: TooltipTab }
  | { readonly type: 'label'; readonly value: string }
  | { readonly type: 'comment'; readonly value: string }
  | { readonly type: 'why'; readonly value: string }
  | { readonly type: 'showWhy' }
  | { readonly type: 'forceApply'; readonly value: boolean }
  | { readonly type: 'text'; readonly value: string | null }
  | { readonly type: 'style'; readonly prop: StyleProperty; readonly value: string }
  | { readonly type: 'resetStyle'; readonly props: readonly StyleProperty[] }
  | { readonly type: 'hidden'; readonly value: boolean }
  | { readonly type: 'scope'; readonly value: 'this' | 'similar' }
  | { readonly type: 'resetAll' }
  | { readonly type: 'escape' }
  | { readonly type: 'saving' }
  | { readonly type: 'saveFailed'; readonly tag: string }
  | { readonly type: 'elementStatus'; readonly value: ElementStatus }
  | { readonly type: 'hydrate'; readonly snapshot: DraftSnapshot }
  | { readonly type: 'dismissResume' }
  | { readonly type: 'dismissHint' };

const controlsFromEdits = (
  edits: Edits | undefined,
  similar: InitOptions['similar'],
): DraftEdits => ({
  text: edits?.text?.after ?? null,
  style: Object.fromEntries((edits?.style ?? []).map((c) => [c.property, c.after])),
  hidden: edits?.hidden ?? false,
  scope: edits?.scope ?? 'this',
  similarSelector: similar.selector,
  similarCount: similar.count,
});

/** Content that counts toward "dirty" and is compared against the opening snapshot. */
export const snapshotKey = (s: Omit<TooltipState, 'initialKey'>): string =>
  JSON.stringify({
    label: s.label,
    comment: s.comment,
    why: s.why,
    forceApply: s.forceApply,
    diff: toDiff(s.baseline, s.controls),
  });

export const initialState = (o: InitOptions): TooltipState => {
  const base: Omit<TooltipState, 'initialKey'> = {
    seq: o.seq,
    mode: o.mode,
    tab: o.tab,
    label: o.label ?? '',
    comment: o.comment ?? '',
    why: o.why ?? '',
    showWhy: (o.why ?? '') !== '',
    forceApply: o.forceApply ?? false,
    controls: controlsFromEdits(o.edits, o.similar),
    baseline: o.baseline,
    escArmed: false,
    saving: false,
    error: null,
    elementStatus: 'ok',
    selectionText: o.selectionText ?? null,
    resume: o.resume ?? null,
    showHint: o.showHint ?? false,
  };
  return { ...base, initialKey: snapshotKey(base) };
};

const withControls = (s: TooltipState, patch: Partial<DraftEdits>): TooltipState => ({
  ...s,
  controls: { ...s.controls, ...patch },
});

const without = (
  style: DraftEdits['style'],
  props: readonly StyleProperty[],
): DraftEdits['style'] =>
  Object.fromEntries(Object.entries(style).filter(([k]) => !props.includes(k as StyleProperty)));

const edit = (s: TooltipState): TooltipState => ({ ...s, escArmed: false, error: null });

const hydrate = (s: TooltipState, d: DraftSnapshot): TooltipState => ({
  ...s,
  label: d.label,
  comment: d.comment,
  why: d.why,
  showWhy: d.showWhy || d.why !== '',
  forceApply: d.forceApply,
  tab: d.tab,
  controls: { ...s.controls, text: d.text, style: d.style, hidden: d.hidden, scope: d.scope },
  resume: null,
});

export const reduce = (s: TooltipState, a: Action): TooltipState => {
  switch (a.type) {
    case 'tab':
      return { ...s, tab: a.value };
    case 'label':
      return edit({ ...s, label: a.value });
    case 'comment':
      return edit({ ...s, comment: a.value });
    case 'why':
      return edit({ ...s, why: a.value });
    case 'showWhy':
      return { ...s, showWhy: true };
    case 'forceApply':
      return edit({ ...s, forceApply: a.value });
    case 'text':
      return edit(withControls(s, { text: a.value }));
    case 'style':
      return edit(withControls(s, { style: { ...s.controls.style, [a.prop]: a.value } }));
    case 'resetStyle':
      return edit(withControls(s, { style: without(s.controls.style, a.props) }));
    case 'hidden':
      return edit(withControls(s, { hidden: a.value }));
    case 'scope':
      return edit(withControls(s, { scope: a.value }));
    case 'resetAll':
      return edit(withControls(s, { text: null, style: {}, hidden: false, scope: 'this' }));
    case 'escape':
      return { ...s, escArmed: s.escArmed || isDirtyState(s) };
    case 'saving':
      return { ...s, saving: true, error: null };
    case 'saveFailed':
      return { ...s, saving: false, error: a.tag };
    case 'elementStatus':
      return { ...s, elementStatus: a.value };
    case 'hydrate':
      return hydrate(s, a.snapshot);
    case 'dismissResume':
      return { ...s, resume: null };
    case 'dismissHint':
      return { ...s, showHint: false };
  }
};

const isDirtyState = (s: TooltipState): boolean => snapshotKey(s) !== s.initialKey;
