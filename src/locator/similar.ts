import { cssEscape, queryAll } from './css';
import { stableClasses } from './hashed';
import { uniqueSelector } from './selector';

export interface SimilarResult {
  readonly selector: string;
  readonly count: number;
}

/** Elements sharing el's tag and stable classes; count includes el. */
export function findSimilar(el: Element, doc: Document): SimilarResult {
  const classes = stableClasses(el);
  if (classes.length === 0) return { selector: uniqueSelector(el, doc), count: 1 };
  const selector = `${el.tagName.toLowerCase()}${classes.map((c) => `.${cssEscape(c)}`).join('')}`;
  return { selector, count: Math.max(1, queryAll(doc, selector).length) };
}
