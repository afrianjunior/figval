import { Effect } from 'effect';
import { ElementNotFound, type DomStep, type NoteId, type Target } from '../domain';
import { attrValue, queryAll, queryUnique } from './css';
import { clip, visibleText } from './text';
import { MAX_TEXT } from './build';

const byTestid = (t: Target, doc: Document): Element | null =>
  t.attrs.testid ? queryUnique(doc, `[data-testid="${attrValue(t.attrs.testid)}"]`) : null;

const byId = (t: Target, doc: Document): Element | null =>
  t.attrs.id ? queryUnique(doc, `[id="${attrValue(t.attrs.id)}"]`) : null;

const bySelector = (t: Target, doc: Document): Element | null =>
  t.selector ? queryUnique(doc, t.selector) : null;

const byTextAndTag = (t: Target, doc: Document): Element | null => {
  const tag = t.domPath.at(-1)?.tag;
  if (!tag || !t.text) return null;
  const hits = queryAll(doc, tag).filter((e) => clip(visibleText(e), MAX_TEXT) === t.text);
  return hits.length === 1 ? (hits[0] ?? null) : null;
};

function matchesStep(el: Element, step: DomStep): boolean {
  if (el.tagName.toLowerCase() !== step.tag) return false;
  if (step.id !== undefined && el.id !== step.id) return false;
  if (step.testid !== undefined && el.getAttribute('data-testid') !== step.testid) return false;
  if (!step.classes.every((c) => el.classList.contains(c))) return false;
  if (step.nth === undefined) return true;
  const same = Array.from(el.parentElement?.children ?? []).filter((s) => s.tagName === el.tagName);
  return same.indexOf(el) + 1 === step.nth;
}

const byDomPath = (t: Target, doc: Document): Element | null => {
  const [first, ...rest] = t.domPath;
  if (!first) return null;
  const start = queryAll(doc, first.tag).filter((e) => matchesStep(e, first));
  const end = rest.reduce<readonly Element[]>(
    (level, step) =>
      level.flatMap((e) => Array.from(e.children).filter((c) => matchesStep(c, step))),
    start,
  );
  return end.length === 1 ? (end[0] ?? null) : null;
};

const CHAIN = [byTestid, byId, bySelector, byTextAndTag, byDomPath] as const;

/** Re-find an element: testid → id → selector → text+tag → domPath. */
export function findElement(target: Target, doc: Document): Element | null {
  for (const step of CHAIN) {
    const hit = step(target, doc);
    if (hit) return hit;
  }
  return null;
}

/** Edge wrapper: failure is `ElementNotFound` for the given note. */
export const findElementEffect = (
  target: Target,
  doc: Document,
  noteId: NoteId,
): Effect.Effect<Element, ElementNotFound> =>
  Effect.suspend(() => {
    const el = findElement(target, doc);
    return el ? Effect.succeed(el) : Effect.fail(new ElementNotFound({ noteId }));
  });
