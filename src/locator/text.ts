const WS = /\s+/g;

/** Collapse whitespace and trim. */
export const normalizeText = (s: string | null | undefined): string =>
  (s ?? '').replace(WS, ' ').trim();

/** Visible text of an element (textContent based; no layout APIs). */
export const visibleText = (el: Element): string => normalizeText(el.textContent);

export const clip = (s: string, max: number): string => (s.length <= max ? s : s.slice(0, max));
