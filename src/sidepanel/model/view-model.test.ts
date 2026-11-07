import { describe, expect, it } from 'vitest';
import { defaultSettings, emptyEdits, type Note } from '../../domain';
import { PanelState, Strip } from './panel-state';
import { exportNotes, mergeOrder } from './selection';
import { emptyFilters, initialState, withUi, type ModelState } from './state';
import { mkNote, mkSession, mkTab, nid, sessionIdOf } from './test-kit';
import { derivePanelState, SEARCH_MIN_NOTES } from './view-model';

const session = mkSession('aaaa', { name: 'Landing revamp' });
const tab = { id: mkTab(1).id, url: 'https://example.com/register', title: 'Register' };
const onPage = (n: number, over: Partial<Note> = {}) =>
  mkNote(n, { page: { url: 'https://example.com/register', title: 'R', viewport: { w: 1, h: 1 }, dpr: 1 }, ...over });
const home = (n: number, over: Partial<Note> = {}) => mkNote(n, over);

const base = (over: Partial<ModelState> = {}): ModelState => ({
  ...initialState,
  loaded: { settings: true, sessions: true },
  settings: { ...defaultSettings, activeSessionId: session.id },
  sessions: [session],
  activeTab: tab,
  activation: { ...initialState.activation, active: true },
  ...over,
});

const ui = (s: ModelState, patch: Parameters<typeof withUi>[1]) => withUi(s, patch);

const ready = (s: ModelState) => {
  const p = derivePanelState(s);
  if (p._tag !== 'Ready') throw new Error(`expected Ready, got ${p._tag}`);
  return p;
};

describe('derivePanelState variants', () => {
  it('Loading until settings and sessions arrive', () => {
    expect(derivePanelState(initialState)._tag).toBe('Loading');
    expect(derivePanelState(base({ loaded: { settings: true, sessions: false } }))._tag).toBe('Loading');
  });

  it('FirstRun without an active session', () => {
    const p = derivePanelState(base({ settings: defaultSettings, sessions: [] }));
    expect(p._tag).toBe('FirstRun');
    expect(PanelState.$is('FirstRun')(p) && p.shell.footer.exportDisabled).toBe(true);
  });

  it('EmptySession with an active session and zero notes', () => {
    const p = derivePanelState(base());
    expect(p._tag).toBe('EmptySession');
    expect(PanelState.$is('EmptySession')(p) && p.shell.footer.exportDisabled).toBe(true);
  });

  it('Ready puts the current page first and others after, in order', () => {
    const s = base({ notes: [home(1), onPage(2), onPage(3)] });
    const p = ready(s);
    expect(p.groups.map((g) => g.path)).toEqual(['/register', '/']);
    expect(p.currentGroup?.isCurrent).toBe(true);
    expect(p.currentGroup?.rows.map((r) => r.label)).toEqual(['FV-2', 'FV-3']);
    expect(p.otherGroups.map((g) => g.pageKey)).toEqual(['example.com/']);
    expect(p.emptyCurrentPage).toBe(false);
  });

  it('Ready flags an empty current page when notes exist elsewhere', () => {
    const p = ready(base({ notes: [home(1)] }));
    expect(p.emptyCurrentPage).toBe(true);
    expect(p.currentGroup?.rows).toEqual([]);
    expect(p.groups[0]?.isCurrent).toBe(true);
  });

  it('Ready on an unsupported page has no current group', () => {
    const s = base({
      notes: [home(1)],
      activeTab: { ...tab, url: 'chrome://extensions' },
      activation: { ...initialState.activation, unsupported: true },
    });
    const p = ready(s);
    expect(p.unsupported).toBe(true);
    expect(p.currentGroup).toBeNull();
    expect(p.shell.toolbar.helperKey).toBe('unsupported');
    expect(p.shell.toolbar.pickDisabled).toBe(true);
    expect(p.groups).toHaveLength(1);
  });

  it('shows the NotActivated strip when the page has notes and Figval is inactive', () => {
    const s = base({
      notes: [onPage(1), onPage(2)],
      activation: { ...initialState.activation, active: false },
    });
    const p = ready(s);
    expect(p.strip).toEqual(Strip.NotActivated({ count: 2 }));
    expect(ready(base({ notes: [onPage(1)] })).strip).toBeNull();
  });

  it('shows the OtherSession strip for notes on this page in an inactive session', () => {
    const other = mkSession('bbbb', { name: 'Old review', updatedAt: 9 });
    const s = base({
      notes: [home(1)],
      sessions: [session, other],
      sessionPageCounts: { [other.id]: { 'example.com/register': 3 } },
    });
    expect(ready(s).strip).toEqual(
      Strip.OtherSession({ count: 3, sessionName: 'Old review', sessionId: sessionIdOf('bbbb') }),
    );
  });

  it('picks the other session with the most notes on this page', () => {
    const a = mkSession('bbbb', { name: 'A', updatedAt: 1 });
    const b = mkSession('cccc', { name: 'B', updatedAt: 2 });
    const s = base({
      notes: [home(1)],
      sessions: [session, a, b],
      sessionPageCounts: {
        [a.id]: { 'example.com/register': 2 },
        [b.id]: { 'example.com/register': 2 },
      },
    });
    expect(ready(s).strip).toMatchObject({ _tag: 'OtherSession', sessionName: 'B' });
  });

  it('reports noResults with the query when filters match nothing', () => {
    const s = ui(base({ notes: [onPage(1), onPage(2)] }), { search: '  zzz ' });
    const p = ready(s);
    expect(p.noResults).toEqual({ query: 'zzz' });
    expect(p.groups[0]?.rows).toEqual([]);
    expect(p.emptyCurrentPage).toBe(false);
  });

  it('shows search from five notes up', () => {
    const notes = (n: number) => Array.from({ length: n }, (_, i) => onPage(i + 1));
    expect(ready(base({ notes: notes(SEARCH_MIN_NOTES - 1) })).showSearch).toBe(false);
    expect(ready(base({ notes: notes(SEARCH_MIN_NOTES) })).showSearch).toBe(true);
  });

  it('hides the pending-delete note optimistically', () => {
    const s = ui(base({ notes: [onPage(1), onPage(2)] }), { pendingDelete: { id: nid(1), until: 5000 } });
    const p = ready(s);
    expect(p.currentGroup?.rows.map((r) => r.label)).toEqual(['FV-2']);
    expect(p.shell.header.count).toBe(1);
    expect(p.shell.pendingDelete?.id).toBe(nid(1));
    const only = ui(base({ notes: [onPage(1)] }), { pendingDelete: { id: nid(1), until: 5000 } });
    expect(derivePanelState(only)._tag).toBe('EmptySession');
  });

  it('marks rows: not found, hovered, selected, intent, tags', () => {
    const edited = onPage(2, { edits: { ...emptyEdits, hidden: true }, comment: 'x' });
    const s = ui(
      base({ notes: [onPage(1), edited], missingIds: [nid(1)], hoverNoteId: nid(2) }),
      { selectedIds: new Set([nid(2)]) },
    );
    const rows = ready(s).currentGroup?.rows ?? [];
    expect(rows[0]).toMatchObject({ notFound: true, intent: 'propose', tags: [], hovered: false });
    expect(rows[1]).toMatchObject({ selected: true, hovered: true, intent: 'apply', tags: ['hide', 'comment'] });
  });

  it('honours the drag order held locally', () => {
    const s = ui(base({ notes: [onPage(1), onPage(2)] }), { localOrder: [nid(2), nid(1)] });
    expect(ready(s).currentGroup?.rows.map((r) => r.label)).toEqual(['FV-2', 'FV-1']);
  });

  it('Detail for the open note, and falls back to the list when it is gone', () => {
    const s = ui(base({ notes: [onPage(1)] }), { view: 'detail', detailId: nid(1) });
    const p = derivePanelState(s);
    expect(PanelState.$is('Detail')(p) && p.row.label).toBe('FV-1');
    expect(PanelState.$is('Detail')(p) && p.canForceApply).toBe(true);
    const gone = ui(base({ notes: [onPage(2)] }), { view: 'detail', detailId: nid(1) });
    expect(derivePanelState(gone)._tag).toBe('Ready');
  });

  it('Detail reports shots and blocks force-apply when there are edits', () => {
    const note = onPage(1, {
      edits: { ...emptyEdits, text: { before: 'a', after: 'b' } },
      shots: { before: nid(9) as never, after: null },
    });
    const p = derivePanelState(ui(base({ notes: [note] }), { view: 'detail', detailId: nid(1) }));
    expect(PanelState.$is('Detail')(p) && p.canForceApply).toBe(false);
    expect(PanelState.$is('Detail')(p) && p.hasShots).toEqual({ before: true, after: false });
  });

  it('Sessions sorted by updatedAt with counts and a delete confirmation', () => {
    const old = mkSession('bbbb', { name: 'Old', updatedAt: 5 });
    const s = ui(
      base({
        notes: [onPage(1)],
        sessions: [session, old],
        sessionPageCounts: { [old.id]: { 'a.com/': 2, 'b.com/': 1 } },
      }),
      { view: 'sessions', confirmDeleteSession: old.id },
    );
    const p = derivePanelState(s);
    if (p._tag !== 'Sessions') throw new Error(p._tag);
    expect(p.sessions.map((r) => [r.session.name, r.noteCount, r.isActive])).toEqual([
      ['Old', 3, false],
      ['Landing revamp', 1, true],
    ]);
    expect(p.confirmDelete).toEqual({ id: old.id, name: 'Old', noteCount: 3 });
  });

  it('Settings carries the corrupt count', () => {
    const p = derivePanelState(ui(base({ corruptCount: 2 }), { view: 'settings' }));
    expect(PanelState.$is('Settings')(p) && p.corruptCount).toBe(2);
  });
});

describe('toolbar helper key', () => {
  const key = (a: Partial<ModelState['activation']>) =>
    ready(base({ notes: [home(1)], activation: { ...initialState.activation, ...a } })).shell.toolbar.helperKey;
  it('maps activation state to copy keys', () => {
    expect(key({})).toBe('inactive');
    expect(key({ active: true })).toBe('active');
    expect(key({ permissionDenied: true })).toBe('permissionDeclined');
    expect(key({ injectionFailed: true })).toBe('injectionFailed');
    expect(key({ unsupported: true })).toBe('unsupported');
  });
});

describe('search and filters', () => {
  const notes = [
    onPage(1, { comment: 'Too LOUD colour' }),
    onPage(2, { why: 'brand guideline', target: { ...mkNote(2).target, label: 'Email label', text: 'Your email' } }),
    home(3, { comment: 'spacing', edits: { ...emptyEdits, style: [{ property: 'color', before: 'a', after: 'b' }] } }),
    home(4, { forceApply: true, comment: 'x' }),
  ];
  const rows = (s: ModelState) => ready(s).groups.flatMap((g) => g.rows.map((r) => r.label));
  const model = (patch: Parameters<typeof withUi>[1]) => ui(base({ notes }), patch);

  it('searches seq, label, comment, why, target text and path case-insensitively', () => {
    expect(rows(model({ search: 'fv-3' }))).toEqual(['FV-3']);
    expect(rows(model({ search: 'email label' }))).toEqual(['FV-2']);
    expect(rows(model({ search: 'loud' }))).toEqual(['FV-1']);
    expect(rows(model({ search: 'GUIDELINE' }))).toEqual(['FV-2']);
    expect(rows(model({ search: 'your email' }))).toEqual(['FV-2']);
    expect(rows(model({ search: '/register' }))).toEqual(['FV-1', 'FV-2']);
  });

  it('filters by type, intent and not found, and combines them with AND', () => {
    expect(rows(model({ filters: { ...emptyFilters, types: new Set(['style' as const]) } }))).toEqual(['FV-3']);
    expect(rows(model({ filters: { ...emptyFilters, intents: new Set(['propose' as const]) } }))).toEqual(['FV-1', 'FV-2']);
    expect(rows(model({ filters: { ...emptyFilters, intents: new Set(['apply' as const]) }, search: 'spacing' }))).toEqual(['FV-3']);
    const missing = ui(base({ notes, missingIds: [nid(2)] }), { filters: { ...emptyFilters, notFound: true } });
    expect(rows(missing)).toEqual(['FV-2']);
  });
});

describe('export selection', () => {
  const notes = [onPage(1), onPage(2), home(3), home(4, { comment: 'needle' })];
  const model = (patch: Parameters<typeof withUi>[1]) => ui(base({ notes }), patch);
  const seqs = (s: ModelState) => exportNotes(s).map((n) => n.seq as number);

  it('all and page scopes', () => {
    expect(seqs(model({ scope: 'all' }))).toEqual([1, 2, 3, 4]);
    expect(seqs(model({ scope: 'page' }))).toEqual([1, 2]);
  });

  it('selected scope with and without checked notes', () => {
    const none = ready(model({ scope: 'selected' }));
    expect(none.shell.footer.exportDisabled).toBe(true);
    expect(none.shell.footer.hintKey).toBe('exportNothingSelected');
    const some = model({ scope: 'selected', selectedIds: new Set([nid(3), nid(1)]) });
    expect(seqs(some)).toEqual([1, 3]);
    expect(ready(some).shell.footer.exportDisabled).toBe(false);
    expect(ready(some).shell.footer.counts.selected).toBe(2);
  });

  it('filtered scope follows the active filter and falls back to all without one', () => {
    expect(seqs(model({ scope: 'filtered', search: 'needle' }))).toEqual([4]);
    const idle = ready(model({ scope: 'filtered' }));
    expect(idle.shell.footer.scope).toBe('all');
    expect(idle.shell.footer.filterActive).toBe(false);
    expect(ready(model({ search: 'needle' })).shell.footer.counts.filtered).toBe(1);
  });

  it('disables export when the scope is empty without the selection hint', () => {
    const p = ready(ui(base({ notes: [home(1)] }), { scope: 'page' }));
    expect(p.shell.footer.exportDisabled).toBe(true);
    expect(p.shell.footer.hintKey).toBeNull();
  });

  it('excludes the pending-delete note from exports', () => {
    const s = ui(base({ notes }), { pendingDelete: { id: nid(1), until: 1 } });
    expect(seqs(s)).toEqual([2, 3, 4]);
  });
});

describe('mergeOrder', () => {
  const n = nid;
  it('refills only the slots of the moved notes', () => {
    expect(mergeOrder([n(1), n(2), n(3), n(4)], [n(4), n(2)])).toEqual([n(1), n(4), n(3), n(2)]);
  });
  it('appends moved notes the session does not list yet', () => {
    expect(mergeOrder([n(1)], [n(2), n(1)])).toEqual([n(1), n(2)]);
  });
});
