import type { StyleProperty } from '../../domain';
import { toHex } from './color';

export interface Baseline {
  readonly text: string | null;
  readonly style: Readonly<Record<StyleProperty, string>>;
  /** Four-side computed padding, e.g. "8px 16px 12px 16px". */
  readonly padding: string;
  readonly hasEditableText: boolean;
}

const WEIGHTS: Readonly<Record<string, string>> = { normal: '400', bold: '700' };

const axis = (a: string, b: string): string => (a === b ? a : `${a} ${b}`);

export const editableText = (el: Element): string | null =>
  el.childElementCount === 0 && (el.textContent ?? '').trim() !== ''
    ? (el.textContent ?? '')
    : null;

export const computeBaseline = (el: Element): Baseline => {
  const cs = (el.ownerDocument.defaultView ?? window).getComputedStyle(el);
  const get = (p: string, fallback = ''): string => cs.getPropertyValue(p).trim() || fallback;
  const [top, right, bottom, left] = ['top', 'right', 'bottom', 'left'].map((s) =>
    get(`padding-${s}`, '0px'),
  ) as [string, string, string, string];
  const weight = get('font-weight', '400');
  const text = editableText(el);
  return {
    text,
    hasEditableText: text !== null,
    padding: `${top} ${right} ${bottom} ${left}`,
    style: {
      color: toHex(get('color')),
      'background-color': toHex(get('background-color', 'rgba(0, 0, 0, 0)')),
      'font-size': get('font-size'),
      'font-weight': WEIGHTS[weight] ?? weight,
      'padding-block': axis(top, bottom),
      'padding-inline': axis(left, right),
      'border-radius': get('border-radius') || get('border-top-left-radius', '0px'),
      'text-align': get('text-align', 'start'),
    },
  };
};
