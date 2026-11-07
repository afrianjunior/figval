import { isOpaqueHex, toHex } from './color';

const DEFAULT_MAX = 8;
const SCAN_LIMIT = 3000;

const isFigval = (el: Element): boolean =>
  el.getAttributeNames().some((n) => n.startsWith('data-fv'));

const colorsOf = (el: Element, view: Window): string[] => {
  const cs = view.getComputedStyle(el);
  return [cs.getPropertyValue('color'), cs.getPropertyValue('background-color')]
    .map((c) => toHex(c))
    .filter(isOpaqueHex);
};

/** Distinct opaque hex colors used by text and backgrounds on the page, most frequent first. */
export const pageSwatches = (doc: Document, max: number = DEFAULT_MAX): readonly string[] => {
  const view = doc.defaultView;
  if (!view) return [];
  const counts = new Map<string, number>();
  const nodes = [...doc.querySelectorAll('body, body *')].slice(0, SCAN_LIMIT);
  for (const el of nodes) {
    if (isFigval(el)) continue;
    for (const hex of colorsOf(el, view)) counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([hex]) => hex);
};
