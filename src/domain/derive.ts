import type { NoteId } from './ids';
import type { Note } from './records';

export type NoteTag = 'text' | 'style' | 'hide' | 'comment';
export type Intent = 'apply' | 'propose';

export interface NormalizedPage {
  readonly host: string;
  readonly path: string;
}

export interface PageGroup extends NormalizedPage {
  readonly pageKey: string;
  readonly notes: readonly Note[];
}

type EditView = Pick<Note, 'edits'>;

export const hasEdits = (note: EditView): boolean =>
  note.edits.text !== null || note.edits.style.length > 0 || note.edits.hidden;

export const intent = (note: EditView & Pick<Note, 'forceApply'>): Intent =>
  hasEdits(note) || note.forceApply ? 'apply' : 'propose';

export const tags = (note: EditView & Pick<Note, 'comment'>): readonly NoteTag[] => {
  const out: NoteTag[] = [];
  if (note.edits.text !== null) out.push('text');
  if (note.edits.style.length > 0) out.push('style');
  if (note.edits.hidden) out.push('hide');
  if (note.comment !== '') out.push('comment');
  return out;
};

export const normalizePage = (url: string): NormalizedPage => {
  if (!URL.canParse(url)) return { host: '', path: url };
  const parsed = new URL(url);
  const host = parsed.host.replace(/^www\./, '');
  const trimmed = parsed.pathname.replace(/\/+$/, '');
  return { host, path: trimmed === '' ? '/' : trimmed };
};

export const normalizePageKey = (url: string): string => {
  const { host, path } = normalizePage(url);
  return host + path;
};

const sortByOrder = (notes: readonly Note[], order: readonly NoteId[]): readonly Note[] => {
  const rank = new Map(order.map((id, i) => [id, i] as const));
  const rankOf = (n: Note): number => rank.get(n.id) ?? Number.MAX_SAFE_INTEGER;
  return notes
    .map((note, index) => ({ note, index }))
    .sort((a, b) => rankOf(a.note) - rankOf(b.note) || a.index - b.index)
    .map((entry) => entry.note);
};

export const groupByPage = (
  notes: readonly Note[],
  order: readonly NoteId[],
): readonly PageGroup[] => {
  const buckets = new Map<string, { page: NormalizedPage; notes: Note[] }>();
  for (const note of sortByOrder(notes, order)) {
    const pageKey = normalizePageKey(note.page.url);
    const bucket = buckets.get(pageKey) ?? { page: normalizePage(note.page.url), notes: [] };
    bucket.notes.push(note);
    buckets.set(pageKey, bucket);
  }
  return [...buckets].map(([pageKey, b]) => ({ pageKey, host: b.page.host, path: b.page.path, notes: b.notes }));
};
