import type { Edits } from '../../domain';
import { applyEdits, restoreElement, resumePreviews, suspendPreviews, targetsOf } from './apply';

export interface EditRegistry {
  apply(noteId: string, el: Element, edits: Edits): void;
  remove(noteId: string): void;
  /** Visually reverts all registered edits and any active preview; keeps the registry. */
  editsOff(): void;
  /** Re-applies everything editsOff reverted. */
  editsOn(): void;
  isOn(): boolean;
  entries(): ReadonlyArray<{ noteId: string; edits: Edits }>;
  /** The element the note's edits were last applied to. */
  elementOf(noteId: string): Element | null;
}

interface Entry {
  readonly el: Element;
  readonly edits: Edits;
}

export const makeEditRegistry = (doc: Document): EditRegistry => {
  // Replaced, never mutated in place.
  let entries: ReadonlyMap<string, Entry> = new Map();
  let on = true;

  const release = (entry: Entry): void =>
    targetsOf(entry.el, entry.edits, doc).forEach(restoreElement);
  const paint = (entry: Entry): void =>
    targetsOf(entry.el, entry.edits, doc).forEach((t) =>
      applyEdits(t, entry.edits, t === entry.el),
    );
  const paintAll = (map: ReadonlyMap<string, Entry>): void => map.forEach(paint);
  const without = (id: string): ReadonlyMap<string, Entry> => {
    const next = new Map(entries);
    next.delete(id);
    return next;
  };

  return {
    apply(noteId, el, edits) {
      const next = new Map(entries).set(noteId, { el, edits });
      if (on) {
        entries.forEach(release);
        entries = next;
        paintAll(entries);
      } else {
        entries = next;
      }
    },
    remove(noteId) {
      if (!entries.has(noteId)) return;
      if (on) entries.forEach(release);
      entries = without(noteId);
      if (on) paintAll(entries);
    },
    editsOff() {
      if (!on) return;
      on = false;
      suspendPreviews();
      entries.forEach(release);
    },
    editsOn() {
      if (on) return;
      on = true;
      paintAll(entries);
      resumePreviews(doc);
    },
    isOn: () => on,
    entries: () => [...entries].map(([noteId, e]) => ({ noteId, edits: e.edits })),
    elementOf: (noteId) => entries.get(noteId)?.el ?? null,
  };
};
