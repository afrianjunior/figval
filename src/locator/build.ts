import type { DomStep, Target } from '../domain';
import { nearestBlock } from './dom';
import { autoLabel } from './label';
import { trimHtml } from './html';
import { uniqueSelector } from './selector';
import { clip, normalizeText, visibleText } from './text';

export const MAX_TEXT = 200;
export const MAX_HTML = 2048;
export const MAX_PATH = 6;
export const CONTEXT_CHARS = 80;

export interface BuildOptions {
  readonly state?: Target['state'];
}

const LANDMARK_TAGS = new Set(['header', 'nav', 'main', 'footer', 'aside', 'form']);
const LANDMARK_ROLES = new Set([
  'banner',
  'navigation',
  'main',
  'contentinfo',
  'complementary',
  'form',
  'region',
  'search',
]);

function isLandmark(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  if (LANDMARK_TAGS.has(tag)) return true;
  if (tag === 'section' && (el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby')))
    return true;
  const role = el.getAttribute('role');
  return role !== null && LANDMARK_ROLES.has(role);
}

function nthAmongSameTag(el: Element): number | undefined {
  const same = Array.from(el.parentElement?.children ?? []).filter((s) => s.tagName === el.tagName);
  return same.length > 1 ? same.indexOf(el) + 1 : undefined;
}

function toStep(el: Element): DomStep {
  const nth = nthAmongSameTag(el);
  const testid = el.getAttribute('data-testid');
  return {
    tag: el.tagName.toLowerCase(),
    classes: Array.from(el.classList),
    ...(el.id ? { id: el.id } : {}),
    ...(nth !== undefined ? { nth } : {}),
    ...(testid ? { testid } : {}),
  };
}

/** Nearest landmark (or body child) down to el, last 6 steps. */
export function buildDomPath(el: Element): readonly DomStep[] {
  const chain: Element[] = [];
  let cur: Element | null = el;
  while (cur && cur.tagName !== 'BODY' && cur.tagName !== 'HTML') {
    chain.unshift(cur);
    if (cur !== el && isLandmark(cur)) break;
    cur = cur.parentElement;
  }
  return chain.slice(-MAX_PATH).map(toStep);
}

function buildAttrs(el: Element): Target['attrs'] {
  const entries: ReadonlyArray<readonly [keyof Target['attrs'], string | null]> = [
    ['id', el.getAttribute('id')],
    ['testid', el.getAttribute('data-testid')],
    ['ariaLabel', el.getAttribute('aria-label')],
    ['role', el.getAttribute('role')],
    ['name', el.getAttribute('name')],
  ];
  return Object.fromEntries(entries.filter(([, v]) => v)) as Target['attrs'];
}

function buildSelection(el: Element, range: Range): NonNullable<Target['selection']> {
  const text = normalizeText(range.toString());
  const block = nearestBlock(el);
  const full = visibleText(block);
  const at = text ? full.indexOf(text) : -1;
  if (at < 0) return { text, before: '', after: '' };
  return {
    text,
    before: full.slice(Math.max(0, at - CONTEXT_CHARS), at),
    after: full.slice(at + text.length, at + text.length + CONTEXT_CHARS),
  };
}

/** Describe an element (or a text selection inside it) as a persistent Target. */
export function buildTarget(el: Element, range?: Range, opts: BuildOptions = {}): Target {
  const doc = el.ownerDocument;
  return {
    kind: range ? 'text' : 'element',
    label: autoLabel(el),
    text: clip(visibleText(el), MAX_TEXT),
    attrs: buildAttrs(el),
    classes: Array.from(el.classList),
    domPath: buildDomPath(el),
    selector: uniqueSelector(el, doc),
    html: trimHtml(el, MAX_HTML),
    selection: range ? buildSelection(el, range) : null,
    state: opts.state ?? 'rest',
  };
}

/** Target for the parent element (picker ↑); null at the top. */
export function parentTarget(el: Element, opts?: BuildOptions): Target | null {
  const parent = el.parentElement;
  if (!parent || parent === el.ownerDocument.documentElement) return null;
  return buildTarget(parent, undefined, opts);
}

/** Target for the first element child (picker ↓); null for leaves. */
export function childTarget(el: Element, opts?: BuildOptions): Target | null {
  const child = el.firstElementChild;
  return child ? buildTarget(child, undefined, opts) : null;
}
