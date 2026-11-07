import type { Edits } from '../../domain';
import { editableText } from './baseline';

interface Saved {
  readonly style: string | null;
  readonly text: string | null;
}

interface Store {
  /** Original inline style/text per touched element, so revert is exact. */
  readonly saved: Map<Element, Saved>;
  /** Preview roots -> the elements that preview touched (root plus similar matches). */
  readonly targets: Map<Element, readonly Element[]>;
  readonly edits: Map<Element, Edits>;
}

// DOM bookkeeping only: one store per document, so documents never share preview state.
const stores = new WeakMap<Document, Store>();

const storeOf = (doc: Document): Store => {
  const existing = stores.get(doc);
  if (existing) return existing;
  const created: Store = { saved: new Map(), targets: new Map(), edits: new Map() };
  stores.set(doc, created);
  return created;
};

const docOf = (el: Element): Document => el.ownerDocument;

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
  const { saved } = storeOf(docOf(el));
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
  const { saved } = storeOf(docOf(el));
  const s = saved.get(el);
  if (!s) return;
  if (s.style === null) el.removeAttribute('style');
  else el.setAttribute('style', s.style);
  if (s.text !== null && el.childElementCount === 0 && el.textContent !== s.text)
    el.textContent = s.text;
  saved.delete(el);
};

const clearPreview = (el: Element, doc: Document): void => {
  const store = storeOf(doc);
  for (const t of store.targets.get(el) ?? []) restoreElement(t);
  store.targets.delete(el);
  store.edits.delete(el);
};

const paintPreview = (el: Element, edits: Edits, doc: Document): void => {
  const store = storeOf(doc);
  const targets = targetsOf(el, edits, doc);
  targets.forEach((t) => applyEdits(t, edits, t === el));
  store.targets.set(el, targets);
  store.edits.set(el, edits);
};

/** Applies to el, or to every similarSelector match when scope is 'similar'. Re-callable: replaces the previous preview of el. */
export const preview = (el: Element, edits: Edits, doc: Document): void => {
  clearPreview(el, doc);
  paintPreview(el, edits, doc);
};

/** Restores everything preview touched: inline style, text and hidden. */
export const revert = (el: Element, doc: Document): void => clearPreview(el, doc);

export const activePreviews = (doc: Document): ReadonlyMap<Element, Edits> =>
  new Map(storeOf(doc).edits);

export const suspendPreviews = (doc: Document): void => {
  const store = storeOf(doc);
  for (const el of [...store.edits.keys()]) {
    for (const t of store.targets.get(el) ?? []) restoreElement(t);
  }
};

export const resumePreviews = (doc: Document): void => {
  for (const [el, edits] of [...storeOf(doc).edits]) paintPreview(el, edits, doc);
};

/** Restores every element this document's previews and registry touched, then drops the store. */
export const disposeEdits = (doc: Document): void => {
  const store = stores.get(doc);
  if (!store) return;
  for (const el of [...store.saved.keys()]) restoreElement(el);
  store.saved.clear();
  store.targets.clear();
  store.edits.clear();
  stores.delete(doc);
};
