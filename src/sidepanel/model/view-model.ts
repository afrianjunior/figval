import { hasEdits, normalizePageKey, type Note } from '../../domain';
import {
  PanelState,
  Strip,
  type SessionRowVm,
  type Shell,
} from './panel-state';
import { activeSessionOf, type ModelState } from './state';
import {
  currentPageKey,
  effectiveScope,
  exportCounts,
  filteredNotes,
  groupVm,
  isFilterActive,
  pageGroups,
  rowOf,
  visibleNotes,
} from './selection';

/** The search box appears once a session holds this many notes. */
export const SEARCH_MIN_NOTES = 5;

const helperKey = (state: ModelState): Shell['toolbar']['helperKey'] => {
  const a = state.activation;
  if (a.unsupported) return 'unsupported';
  if (a.permissionDenied) return 'permissionDeclined';
  if (a.injectionFailed) return 'injectionFailed';
  return a.active ? 'active' : 'inactive';
};

const footerOf = (state: ModelState, noteCount: number): Shell['footer'] => {
  const counts = exportCounts(state);
  const scope = effectiveScope(state);
  const nothingSelected = scope === 'selected' && counts.selected === 0;
  return {
    format: state.ui.format,
    scope,
    counts,
    filterActive: isFilterActive(state),
    exportDisabled: noteCount === 0 || nothingSelected || counts[scope] === 0,
    hintKey: nothingSelected && noteCount > 0 ? 'exportNothingSelected' : null,
  };
};

export const shellOf = (state: ModelState): Shell => {
  const session = activeSessionOf(state);
  const count = visibleNotes(state).length;
  return {
    header: { sessionId: session?.id ?? null, sessionName: session?.name ?? null, count },
    toolbar: {
      helperKey: helperKey(state),
      pickDisabled: state.activeTab === null || state.activation.unsupported,
      active: state.activation.active,
      beforeAfter: state.ui.beforeAfter,
    },
    footer: footerOf(state, session === null ? 0 : count),
    activeTab: state.activeTab,
    pendingDelete: state.ui.pendingDelete,
    errors: state.ui.errors,
    flashId: state.ui.flashId,
  };
};

const pageCount = (notes: readonly Note[], key: string): number =>
  notes.filter((n) => normalizePageKey(n.page.url) === key).length;

const otherSessionStrip = (state: ModelState, key: string): Strip | null => {
  const activeId = state.settings.activeSessionId;
  const candidates = state.sessions
    .filter((s) => s.id !== activeId)
    .map((s) => ({ session: s, count: state.sessionPageCounts[s.id]?.[key] ?? 0 }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count || b.session.updatedAt - a.session.updatedAt);
  const best = candidates[0];
  return best === undefined
    ? null
    : Strip.OtherSession({ count: best.count, sessionName: best.session.name, sessionId: best.session.id });
};

const stripOf = (state: ModelState, key: string | null): Strip | null => {
  if (key === null) return null;
  const onPage = pageCount(visibleNotes(state), key);
  if (onPage > 0 && !state.activation.active) return Strip.NotActivated({ count: onPage });
  return onPage === 0 ? otherSessionStrip(state, key) : null;
};

const readyOf = (state: ModelState, shell: Shell): PanelState => {
  const key = currentPageKey(state);
  const filtered = filteredNotes(state);
  const groups = pageGroups(state, filtered);
  const currentRaw = groups.find((g) => g.pageKey === key);
  const current =
    key === null
      ? null
      : groupVm(state, currentRaw ?? { pageKey: key, host: '', path: '', notes: [] }, true);
  const others = groups.filter((g) => g.pageKey !== key).map((g) => groupVm(state, g, false));
  const total = visibleNotes(state).length;
  const filterOn = isFilterActive(state);
  return PanelState.Ready({
    shell,
    groups: current === null ? others : [current, ...others],
    currentGroup: current,
    otherGroups: others,
    emptyCurrentPage: current !== null && current.rows.length === 0 && !filterOn,
    strip: stripOf(state, key),
    unsupported: state.activation.unsupported,
    noResults: filterOn && filtered.length === 0 ? { query: state.ui.search.trim() } : null,
    showSearch: total >= SEARCH_MIN_NOTES,
    search: state.ui.search,
    filters: state.ui.filters,
  });
};

const sessionRows = (state: ModelState): readonly SessionRowVm[] =>
  [...state.sessions]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((session) => {
      const isActive = session.id === state.settings.activeSessionId;
      const counts = Object.values(state.sessionPageCounts[session.id] ?? {});
      return {
        session,
        isActive,
        noteCount: isActive ? visibleNotes(state).length : counts.reduce((a, b) => a + b, 0),
      };
    });

const sessionsOf = (state: ModelState, shell: Shell): PanelState => {
  const rows = sessionRows(state);
  const target = rows.find((r) => r.session.id === state.ui.confirmDeleteSession);
  return PanelState.Sessions({
    shell,
    sessions: rows,
    confirmDelete:
      target === undefined
        ? null
        : { id: target.session.id, name: target.session.name, noteCount: target.noteCount },
  });
};

const detailOf = (state: ModelState, shell: Shell): PanelState | null => {
  const note = visibleNotes(state).find((n) => n.id === state.ui.detailId);
  if (note === undefined) return null;
  return PanelState.Detail({
    shell,
    row: rowOf(state, note),
    canForceApply: !hasEdits(note),
    hasShots: { before: note.shots.before !== null, after: note.shots.after !== null },
  });
};

/** Pure projection of the model onto the UI surface to show (p.impl.md §10.2 States table). */
export const derivePanelState = (state: ModelState): PanelState => {
  if (!state.loaded.settings || !state.loaded.sessions) return PanelState.Loading();
  const shell = shellOf(state);
  const { view } = state.ui;
  if (view === 'settings') {
    return PanelState.Settings({ shell, settings: state.settings, corruptCount: state.corruptCount });
  }
  if (view === 'sessions') return sessionsOf(state, shell);
  if (view === 'detail') {
    const detail = detailOf(state, shell);
    if (detail !== null) return detail;
  }
  if (activeSessionOf(state) === null) {
    return PanelState.FirstRun({ shell, unsupported: state.activation.unsupported });
  }
  if (visibleNotes(state).length === 0) {
    return PanelState.EmptySession({ shell, unsupported: state.activation.unsupported });
  }
  return readyOf(state, shell);
};
