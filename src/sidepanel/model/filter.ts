import { formatSeq, intent, normalizePage, tags, type Note, type NoteId } from '../../domain';
import type { Filters } from './state';

export interface FilterInput {
  readonly search: string;
  readonly filters: Filters;
  readonly missingIds: readonly NoteId[];
}

export const filterActive = ({ search, filters }: Pick<FilterInput, 'search' | 'filters'>): boolean =>
  search.trim() !== '' || filters.types.size > 0 || filters.intents.size > 0 || filters.notFound;

const haystack = (note: Note): string =>
  [
    formatSeq(note.seq),
    note.target.label,
    note.comment,
    note.why,
    note.target.text,
    normalizePage(note.page.url).path,
  ]
    .join('\n')
    .toLowerCase();

export const matchesSearch = (note: Note, query: string): boolean => {
  const q = query.trim().toLowerCase();
  return q === '' || haystack(note).includes(q);
};

export const matchesFilters = (note: Note, input: FilterInput): boolean => {
  const { types, intents, notFound } = input.filters;
  if (types.size > 0 && !tags(note).some((t) => types.has(t))) return false;
  if (intents.size > 0 && !intents.has(intent(note))) return false;
  if (notFound && !input.missingIds.includes(note.id)) return false;
  return matchesSearch(note, input.search);
};

export const applyFilters = (notes: readonly Note[], input: FilterInput): readonly Note[] =>
  filterActive(input) ? notes.filter((n) => matchesFilters(n, input)) : notes;
