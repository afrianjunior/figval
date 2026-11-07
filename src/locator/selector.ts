import { attrValue, cssEscape, queryAll } from './css';
import { isHashedClass, stableClasses } from './hashed';

const isUniqueFor = (el: Element, doc: Document, selector: string): boolean => {
  const found = queryAll(doc, selector);
  return found.length === 1 && found[0] === el;
};

const testidSelector = (value: string): string => `[data-testid="${attrValue(value)}"]`;

/** A selector that anchors the walk: testid or stable unique id. */
function anchorSelector(el: Element, doc: Document): string | null {
  const testid = el.getAttribute('data-testid');
  if (testid && isUniqueFor(el, doc, testidSelector(testid))) return testidSelector(testid);
  const id = el.id;
  if (id && !isHashedClass(id) && isUniqueFor(el, doc, `#${cssEscape(id)}`))
    return `#${cssEscape(id)}`;
  return null;
}

const nthOfType = (el: Element): number =>
  Array.from(el.parentElement?.children ?? [])
    .filter((s) => s.tagName === el.tagName)
    .indexOf(el) + 1;

function segment(el: Element, withNth: boolean): string {
  const tag = el.tagName.toLowerCase();
  const classes = stableClasses(el)
    .map((c) => `.${cssEscape(c)}`)
    .join('');
  const sameTag = Array.from(el.parentElement?.children ?? []).filter(
    (s) => s.tagName === el.tagName,
  );
  return withNth && sameTag.length > 1
    ? `${tag}${classes}:nth-of-type(${nthOfType(el)})`
    : `${tag}${classes}`;
}

/** Walk up from el, building `a > b > c` until unique or anchored. */
function chain(el: Element, doc: Document, withNth: boolean): string | null {
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur !== doc.documentElement) {
    const anchor = cur === el ? null : anchorSelector(cur, doc);
    parts.unshift(anchor ?? segment(cur, withNth));
    const selector = parts.join(' > ');
    if (isUniqueFor(el, doc, selector)) return selector;
    if (anchor) break;
    cur = cur.parentElement;
  }
  return null;
}

/**
 * Shortest verified-unique CSS selector for el:
 * data-testid, then stable id, then tag/stable-class chain, then nth-of-type chain.
 */
export function uniqueSelector(el: Element, doc: Document): string {
  return (
    anchorSelector(el, doc) ?? chain(el, doc, false) ?? chain(el, doc, true) ?? fullPath(el, doc)
  );
}

// Last resort: absolute tag/nth path from <html>; unique by construction.
function fullPath(el: Element, doc: Document): string {
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur !== doc.documentElement) {
    parts.unshift(`${cur.tagName.toLowerCase()}:nth-of-type(${nthOfType(cur)})`);
    cur = cur.parentElement;
  }
  return ['html', ...parts].join(' > ');
}
