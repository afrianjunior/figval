import type { Edits } from '../../domain';
import { editableText } from './baseline';

interface Saved {
  readonly style: string | null;
  readonly text: string | null;
}

// DOM bookkeeping only: original inline style/text per element, so revert is exact.
const saved = new WeakMap<Element, Saved>();
// Preview roots -> the elements that preview touched (root plus similar matches).
const previewTargets = new WeakMap<Element, readonly Element[]>();
const previewEdits = new Map<Element, Edits>();

export const targetsOf = (el: Element, edits: Edits, doc: Document): readonly Element[] => {
  if (edits.scope !== 'similar' || edits.similarSelector === null) return [el];
  let matches: Element[] = [];
  try {
    matches = [...doc.querySelectorAll(edits.similarSelector)];
  } catch {
    matches = [];
  }
  return matches.includes(el) ? matches : [el, ...matches];
};

const remember = (el: Element): void => {
  if (saved.has(el)) return;
  saved.set(el, {
    style: el.getAttribute('style'),
    text: editableText(el) === null ? null : el.textContent,
  });
};

/** Applies edits on top of the element's current state, remembering the original once. */
export const applyEdits = (el: Element, edits: Edits, withText: boolean): void => {
  remember(el);
  const style = (el as HTMLElement).style;
  if (withText && edits.text !== null && el.childElementCount === 0)
    el.textContent = edits.text.after;
  for (const c of edits.style) style.setProperty(c.property, c.after, 'important');
  if (edits.hidden) style.setProperty('display', 'none', 'important');
};

export const restoreElement = (el: Element): void => {
  const s = saved.get(el);
  if (!s) return;
  if (s.style === null) el.removeAttribute('style');
  else el.setAttribute('style', s.style);
  if (s.text !== null && el.childElementCount === 0 && el.textContent !== s.text)
    el.textContent = s.text;
  saved.delete(el);
};

const clearPreview = (el: Element): void => {
  for (const t of previewTargets.get(el) ?? []) restoreElement(t);
  previewTargets.delete(el);
  previewEdits.delete(el);
};

/** Applies to el, or to every similarSelector match when scope is 'similar'. Re-callable: replaces the previous preview of el. */
export const preview = (el: Element, edits: Edits, doc: Document): void => {
  clearPreview(el);
  const targets = targetsOf(el, edits, doc);
  targets.forEach((t) => applyEdits(t, edits, t === el));
  previewTargets.set(el, targets);
  previewEdits.set(el, edits);
};

/** Restores everything preview touched: inline style, text and hidden. */
export const revert = (el: Element, doc: Document): void => {
  void doc; // part of the contract; targets are tracked per preview root
  clearPreview(el);
};

export const activePreviews = (): ReadonlyMap<Element, Edits> => new Map(previewEdits);

export const suspendPreviews = (): void => {
  for (const el of [...previewEdits.keys()]) {
    for (const t of previewTargets.get(el) ?? []) restoreElement(t);
  }
};

export const resumePreviews = (doc: Document): void => {
  for (const [el, edits] of previewEdits) {
    const targets = targetsOf(el, edits, doc);
    targets.forEach((t) => applyEdits(t, edits, t === el));
    previewTargets.set(el, targets);
  }
};
