import { STYLE_PROPERTIES, type Edits, type StyleChange, type StyleProperty } from '../../domain';
import type { Baseline } from './baseline';
import { toHex } from './color';

/** Tooltip control values. Style values are CSS strings; padding axes carry one value applied to both sides. */
export interface DraftEdits {
  readonly text: string | null;
  readonly style: Readonly<Partial<Record<StyleProperty, string>>>;
  readonly hidden: boolean;
  readonly scope: 'this' | 'similar';
  readonly similarSelector: string | null;
  readonly similarCount: number;
}

const COLOR_PROPS: ReadonlySet<StyleProperty> = new Set(['color', 'background-color']);

const norm = (prop: StyleProperty, value: string): string =>
  COLOR_PROPS.has(prop) ? toHex(value) : value.trim().toLowerCase();

const changeFor = (
  baseline: Baseline,
  prop: StyleProperty,
  value: string | undefined,
): StyleChange | null => {
  if (value === undefined || norm(prop, value) === norm(prop, baseline.style[prop])) return null;
  const before =
    prop === 'padding-block' || prop === 'padding-inline' ? baseline.padding : baseline.style[prop];
  return { property: prop, before, after: COLOR_PROPS.has(prop) ? toHex(value) : value.trim() };
};

export const toDiff = (baseline: Baseline, draft: DraftEdits): Edits => {
  const textChanged = draft.text !== null && baseline.text !== null && draft.text !== baseline.text;
  const style = draft.hidden
    ? []
    : STYLE_PROPERTIES.flatMap((p) => {
        const c = changeFor(baseline, p, draft.style[p]);
        return c ? [c] : [];
      });
  const similar = draft.scope === 'similar' && draft.similarSelector !== null;
  return {
    text: textChanged ? { before: baseline.text ?? '', after: draft.text ?? '' } : null,
    style,
    hidden: draft.hidden,
    scope: similar ? 'similar' : 'this',
    similarSelector: similar ? draft.similarSelector : null,
    similarCount: similar ? draft.similarCount : 0,
  };
};
