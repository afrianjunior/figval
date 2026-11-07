import {
  formatSeq,
  groupByPage,
  intent,
  normalizePageKey,
  tags,
  type Note,
  type PageGroup,
} from '../../domain';
import { applyFilters, filterActive } from './filter';
import type { ExportCounts, GroupVm, RowVm } from './panel-state';
import { activeSessionOf, type ExportScope, type ModelState } from './state';

/** Notes the panel may show: the pending-delete note is hidden optimistically. */
export const visibleNotes = (state: ModelState): readonly Note[] => {
  const hidden = state.ui.pendingDelete?.id;
  return hidden === undefined ? state.notes : state.notes.filter((n) => n.id !== hidden);
};

export const currentPageKey = (state: ModelState): string | null =>
  state.activeTab === null || state.activation.unsupported ? null : normalizePageKey(state.activeTab.url);

export const noteOrder = (state: ModelState) =>
  state.ui.localOrder ?? activeSessionOf(state)?.noteOrder ?? [];

export const pageGroups = (state: ModelState, notes: readonly Note[]): readonly PageGroup[] =>
  groupByPage(notes, noteOrder(state));

export const filteredNotes = (state: ModelState): readonly Note[] =>
  applyFilters(visibleNotes(state), {
    search: state.ui.search,
    filters: state.ui.filters,
    missingIds: state.missingIds,
  });

export const rowOf = (state: ModelState, note: Note): RowVm => ({
  note,
  label: formatSeq(note.seq),
  tags: tags(note),
  intent: intent(note),
  notFound: state.missingIds.includes(note.id),
  selected: state.ui.selectedIds.has(note.id),
  hovered: state.hoverNoteId === note.id,
});

export const groupVm = (state: ModelState, group: PageGroup, isCurrent: boolean): GroupVm => ({
  pageKey: group.pageKey,
  host: group.host,
  path: group.path,
  isCurrent,
  rows: group.notes.map((n) => rowOf(state, n)),
});

export const isFilterActive = (state: ModelState): boolean =>
  filterActive({ search: state.ui.search, filters: state.ui.filters });

/** `filtered` only exists while a filter is active; otherwise it falls back to `all`. */
export const effectiveScope = (state: ModelState): ExportScope =>
  state.ui.scope === 'filtered' && !isFilterActive(state) ? 'all' : state.ui.scope;

const ordered = (state: ModelState, notes: readonly Note[]): readonly Note[] =>
  pageGroups(state, notes).flatMap((g) => g.notes);

const forScope = (state: ModelState, scope: ExportScope): readonly Note[] => {
  const all = visibleNotes(state);
  switch (scope) {
    case 'all':
      return ordered(state, all);
    case 'page': {
      const key = currentPageKey(state);
      return ordered(state, all.filter((n) => key !== null && normalizePageKey(n.page.url) === key));
    }
    case 'selected':
      return ordered(state, all.filter((n) => state.ui.selectedIds.has(n.id)));
    case 'filtered':
      return ordered(state, filteredNotes(state));
  }
};

/** Notes the export footer acts on, in export order. */
export const exportNotes = (state: ModelState): readonly Note[] => forScope(state, effectiveScope(state));

export const exportCounts = (state: ModelState): ExportCounts => ({
  all: visibleNotes(state).length,
  page: forScope(state, 'page').length,
  selected: forScope(state, 'selected').length,
  filtered: forScope(state, 'filtered').length,
});
