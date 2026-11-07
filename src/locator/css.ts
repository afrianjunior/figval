/** CSS.escape with a fallback for runtimes that lack it. */
export function cssEscape(value: string): string {
  const native = (globalThis as { CSS?: { escape?: (v: string) => string } }).CSS?.escape;
  if (native) return native(value);
  return value
    .replace(/[^a-zA-Z0-9_\u00a0-\uffff-]/g, (ch) => `\\${ch}`)
    .replace(/^(\d)/, '\\3$1 ');
}

/** Escape a value for use inside a double-quoted attribute selector. */
export function attrValue(value: string): string {
  return value.replace(/["\\]/g, (ch) => `\\${ch}`);
}

/** querySelectorAll that returns [] for invalid selectors. */
export function queryAll(doc: Document, selector: string): readonly Element[] {
  try {
    return Array.from(doc.querySelectorAll(selector));
  } catch {
    return [];
  }
}

/** The single match of a selector, or null when absent or ambiguous. */
export function queryUnique(doc: Document, selector: string): Element | null {
  const found = queryAll(doc, selector);
  return found.length === 1 ? (found[0] ?? null) : null;
}
