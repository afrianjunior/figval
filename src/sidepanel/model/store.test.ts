import { Effect } from 'effect';
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyEdits, type Note } from '../../domain';
import { ChromeStorage, ShotStore, notesKey } from '../../storage';
import { usePanelStore } from './hook';
import { activationKey, HOVER_KEY, missingKey } from './streams';
import { boot, seedStore, type Booted } from './store-kit';
import { mkNote, mkSession, mkTab, nid, runTest, tid } from './test-kit';

const session = mkSession('aaaa', { name: 'Landing revamp' });
const settings = { activeSessionId: session.id };
const PAGE = 'https://example.com/register';
const pageNote = (n: number, over: Partial<Note> = {}) =>
  mkNote(n, { page: { url: PAGE, title: 'R', viewport: { w: 1, h: 1 }, dpr: 1 }, ...over });

let booted: Booted | null = null;
const start = async (...args: Parameters<typeof boot>) => {
  booted = await boot(...args);
  return booted;
};
afterEach(async () => {
  await booted?.store.dispose();
  booted = null;
});

const tab1 = mkTab(1, PAGE);
const withTab = { tabs: [tab1], activeTabId: tab1.id } as const;

describe('store streams', () => {
  it('starts in Loading and settles to FirstRun on empty storage', async () => {
    const b = await start(withTab);
    await b.waitFor((m) => m.loaded.settings && m.loaded.sessions);
    expect(b.store.getSnapshot().panel._tag).toBe('FirstRun');
  });

  it('follows settings, sessions and notes in memory storage', async () => {
    const b = await start(withTab);
    await seedStore(b.store, { sessions: [session], settings });
    await b.waitFor((m) => m.sessions.length === 1 && m.settings.activeSessionId === session.id);
    expect(b.store.getSnapshot().panel._tag).toBe('EmptySession');
    await seedStore(b.store, { notes: [pageNote(1)] });
    await b.waitFor((m) => m.notes.length === 1);
    expect(b.store.getSnapshot().panel._tag).toBe('Ready');
  });

  it('notifies subscribers and exposes a stable snapshot between changes', async () => {
    const b = await start(withTab, {}, { sessions: [session], settings });
    let calls = 0;
    const off = b.store.subscribe(() => (calls += 1));
    const first = b.store.getSnapshot();
    expect(b.store.getSnapshot()).toBe(first);
    await b.store.actions.setSearch('x');
    await b.waitFor((m) => m.ui.search === 'x');
    expect(calls).toBeGreaterThan(0);
    off();
  });

  it('tracks the active tab, its navigation and tab switches', async () => {
    const other = mkTab(2, 'https://other.com/a');
    const b = await start({ tabs: [tab1, other], activeTabId: tab1.id });
    await b.waitFor((m) => m.activeTab?.id === tab1.id);
    await b.driver((d) => d.activate(other.id));
    await b.waitFor((m) => m.activeTab?.url === 'https://other.com/a');
    await b.driver((d) => d.navigate(other.id, 'chrome://extensions'));
    await b.waitFor((m) => m.activation.unsupported);
    await b.driver((d) => d.activate(tab1.id));
    await b.waitFor((m) => m.activeTab?.id === tab1.id && !m.activation.unsupported);
  });

  it('binds to ?tab=<id> and follows its onUpdated events', async () => {
    const other = mkTab(2, 'https://other.com/a');
    const b = await start({ tabs: [tab1, other], activeTabId: tab1.id }, { boundTabId: 2 });
    await b.waitFor((m) => m.activeTab?.id === tid(2));
    await b.driver((d) => d.navigate(other.id, 'https://other.com/b'));
    await b.driver((d) => d.emitUpdate({ tabId: 1, status: 'complete' }));
    await b.driver((d) => d.emitUpdate({ tabId: 2, status: 'loading' }));
    expect(b.model().activeTab?.url).toBe('https://other.com/a');
    await b.driver((d) => d.emitUpdate({ tabId: 2, status: 'complete' }));
    await b.waitFor((m) => m.activeTab?.url === 'https://other.com/b');
    expect(b.model().activeTab?.id).toBe(tid(2));
  });

  it('reads activation, missing ids and hover from session storage', async () => {
    const b = await start(withTab, {}, { sessions: [session], settings, notes: [pageNote(1)] });
    await b.waitFor((m) => m.activeTab !== null);
    await seedStore(b.store, {
      kv: {
        [activationKey(1)]: { tabId: 1, origin: 'https://example.com', active: true },
        [missingKey(1)]: [nid(1)],
        [HOVER_KEY]: { noteId: nid(1), at: 1 },
      },
    });
    await b.waitFor((m) => m.activation.active && m.missingIds.length === 1 && m.hoverNoteId === nid(1));
    await seedStore(b.store, { kv: { [activationKey(1)]: 'garbage', [HOVER_KEY]: { noteId: null, at: 2 } } });
    await b.waitFor((m) => !m.activation.active && m.hoverNoteId === null);
  });

  it('counts notes of other sessions per page', async () => {
    const other = mkSession('bbbb', { name: 'Old', updatedAt: 3 });
    const b = await start(
      withTab,
      {},
      { sessions: [session, other], settings, notes: [mkNote(7, { sessionId: other.id, page: pageNote(1).page }), mkNote(8, { sessionId: other.id, page: pageNote(1).page })] },
    );
    await b.waitFor((m) => (m.sessionPageCounts[other.id]?.['example.com/register'] ?? 0) === 2);
    await b.waitFor((m) => m.activeTab !== null);
    const panel = b.store.getSnapshot().panel;
    expect(panel._tag).toBe('EmptySession');
  });

  it('reports the corrupt count of the active session', async () => {
    const b = await start(withTab, {}, { sessions: [session], settings });
    await b.store.run(Effect.flatMap(ChromeStorage, (kv) => kv.set(notesKey(session.id), [{ id: 'bad' }])) as never);
    await b.waitFor((m) => m.corruptCount === 1);
  });
});

describe('markers sync', () => {
  const active = { [activationKey(1)]: { tabId: 1, origin: 'https://example.com', active: true } };

  it('renders only this page notes once Figval is active on the tab', async () => {
    const b = await start(withTab, {}, { sessions: [session], settings, notes: [pageNote(1), mkNote(2)] });
    await b.waitFor((m) => m.notes.length === 2 && m.activeTab !== null);
    expect(b.harness.toContent).toEqual([]);
    await seedStore(b.store, { kv: active });
    await b.waitFor(() => b.harness.toContent.length > 0);
    const last = b.harness.toContent.at(-1);
    expect(last).toMatchObject({ _tag: 'MarkersRender' });
    expect(last?._tag === 'MarkersRender' && last.notes.map((n) => n.id)).toEqual([nid(1)]);
  });

  it('re-renders without a note that is pending delete', async () => {
    const b = await start(withTab, {}, { sessions: [session], settings, notes: [pageNote(1), pageNote(2)], kv: active });
    await b.waitFor(() => b.harness.toContent.some((r) => r._tag === 'MarkersRender'));
    await b.store.actions.deleteNote(nid(1));
    await b.waitFor(() => {
      const last = b.harness.toContent.at(-1);
      return last?._tag === 'MarkersRender' && last.notes.length === 1;
    });
  });

  it('records a markers error when the content script does not answer', async () => {
    const b = await start(withTab, {}, { sessions: [session], settings, notes: [pageNote(1)] });
    b.harness.failContent.current = true;
    await seedStore(b.store, { kv: active });
    await b.waitFor((m) => m.ui.errors.markers === 'ElementNotFound');
  });
});

describe('delete with undo', () => {
  const seed = { sessions: [session], settings, notes: [pageNote(1), pageNote(2)] };

  it('hides at once, then deletes after 5 s', async () => {
    const b = await start({ ...withTab, now: 1000 }, {}, seed);
    await b.waitFor((m) => m.notes.length === 2);
    await b.store.actions.deleteNote(nid(1));
    await b.waitFor((m) => m.ui.pendingDelete !== null);
    expect(b.model().ui.pendingDelete).toEqual({ id: nid(1), until: 6000 });
    expect(b.harness.toBackground).toEqual([]);
    await b.advance(4999);
    expect(b.harness.toBackground).toEqual([]);
    await b.advance(1);
    await b.waitFor((m) => m.notes.length === 1 && m.ui.pendingDelete === null);
    expect(b.harness.toBackground).toEqual([{ _tag: 'NoteDelete', id: nid(1) }]);
  });

  it('undo cancels the timer and restores the note', async () => {
    const b = await start(withTab, {}, seed);
    await b.waitFor((m) => m.notes.length === 2);
    await b.store.actions.deleteNote(nid(1));
    await b.store.actions.undoDelete();
    await b.advance(10_000);
    expect(b.model().ui.pendingDelete).toBeNull();
    expect(b.model().notes).toHaveLength(2);
    expect(b.harness.toBackground).toEqual([]);
  });

  it('undo with nothing pending is a no-op', async () => {
    const b = await start(withTab, {}, seed);
    await b.store.actions.undoDelete();
    expect(b.model().ui.pendingDelete).toBeNull();
  });

  it('a second delete commits the first immediately', async () => {
    const b = await start(withTab, {}, seed);
    await b.waitFor((m) => m.notes.length === 2);
    await b.store.actions.deleteNote(nid(1));
    await b.store.actions.deleteNote(nid(2));
    await b.waitFor((m) => m.notes.length === 1);
    expect(b.harness.toBackground).toEqual([{ _tag: 'NoteDelete', id: nid(1) }]);
    expect(b.model().ui.pendingDelete?.id).toBe(nid(2));
  });

  it('closes the detail view and clears selection of the deleted note', async () => {
    const b = await start(withTab, {}, seed);
    await b.store.actions.open(nid(1));
    await b.store.actions.toggleSelected(nid(1));
    await b.store.actions.deleteNote(nid(1));
    expect(b.model().ui).toMatchObject({ view: 'list', detailId: null });
    expect(b.model().ui.selectedIds.size).toBe(0);
  });

  it('restores the note and shows an error when the delete fails', async () => {
    const b = await start(withTab, {}, seed);
    await b.waitFor((m) => m.notes.length === 2);
    b.harness.failBackground.current = 'StorageUnavailable';
    await b.store.actions.deleteNote(nid(1));
    await b.advance(5000);
    await b.waitFor((m) => m.ui.pendingDelete === null);
    expect(b.model().notes).toHaveLength(2);
    expect(b.model().ui.errors.delete).toBe('StorageUnavailable');
    expect(b.store.getSnapshot().panel).toMatchObject({ _tag: 'Ready' });
  });

  it('commits a pending delete on dispose', async () => {
    const b = await start(withTab, {}, seed);
    await b.waitFor((m) => m.notes.length === 2);
    await b.store.actions.deleteNote(nid(1));
    await b.store.dispose();
    expect(b.harness.toBackground).toEqual([{ _tag: 'NoteDelete', id: nid(1) }]);
    booted = null;
  });
});

describe('note autosave', () => {
  const seed = { sessions: [session], settings, notes: [pageNote(1)] };

  it('debounces 400 ms and merges patches into one NoteUpdate', async () => {
    const b = await start(withTab, {}, seed);
    await b.waitFor((m) => m.notes.length === 1);
    await b.store.actions.updateNote(nid(1), { comment: 'a' });
    await b.advance(300);
    await b.store.actions.updateNote(nid(1), { why: 'because' });
    await b.advance(300);
    expect(b.harness.toBackground).toEqual([]);
    await b.advance(100);
    await b.waitFor((m) => m.notes[0]?.comment === 'a');
    expect(b.harness.toBackground).toEqual([
      { _tag: 'NoteUpdate', id: nid(1), patch: { comment: 'a', why: 'because' } },
    ]);
    expect(b.model().notes[0]?.why).toBe('because');
  });

  it('back flushes pending edits before leaving the detail', async () => {
    const b = await start(withTab, {}, seed);
    await b.waitFor((m) => m.notes.length === 1);
    await b.store.actions.open(nid(1));
    await b.store.actions.updateNote(nid(1), { comment: 'late', label: 'New label' });
    await b.store.actions.back();
    expect(b.harness.toBackground).toHaveLength(1);
    await b.waitFor((m) => m.notes[0]?.target.label === 'New label');
    expect(b.model().ui.view).toBe('list');
  });

  it('flushNote sends one note and ignores unknown ones', async () => {
    const b = await start(withTab, {}, seed);
    await b.store.actions.flushNote(nid(1));
    await b.store.actions.updateNote(nid(1), { forceApply: true, edits: emptyEdits });
    await b.store.actions.flushNote(nid(1));
    expect(b.harness.toBackground).toHaveLength(1);
  });

  it('keeps an error under note:<id> when the save fails and clears it on success', async () => {
    const b = await start(withTab, {}, seed);
    await b.waitFor((m) => m.notes.length === 1);
    await b.store.actions.updateNote(nid(5), { comment: 'x' });
    await b.advance(400);
    await b.waitFor((m) => m.ui.errors[`note:${nid(5)}`] === 'StorageUnavailable');
    await b.store.actions.dismissError(`note:${nid(5)}`);
    expect(b.model().ui.errors).toEqual({});
  });
});

describe('pick and show', () => {
  const seed = { sessions: [session], settings, notes: [pageNote(1)] };

  it('asks for site access first, then activates the tab via the panel', async () => {
    const b = await start(withTab, {}, seed);
    await b.waitFor((m) => m.activeTab !== null);
    await b.store.actions.pick();
    const calls = await b.recorded();
    expect(calls[0]).toEqual({ service: 'Permissions', op: 'ensureOrigin', args: ['https://example.com'] });
    expect(b.harness.toBackground).toEqual([{ _tag: 'ActivateTab', tabId: 1, via: 'panel' }]);
    await b.waitFor((m) => m.activation.active);
  });

  it('showNotes uses the same activation path and then markers follow', async () => {
    const b = await start(withTab, {}, seed);
    await b.waitFor((m) => m.activeTab !== null);
    await b.store.actions.showNotes();
    await b.waitFor((m) => m.activation.active);
    await b.waitFor(() => b.harness.toContent.some((r) => r._tag === 'MarkersRender'));
  });

  it('maps a declined permission to activation state and does not activate', async () => {
    const b = await start({ ...withTab, permissions: { acceptPrompt: false } }, {}, seed);
    await b.waitFor((m) => m.activeTab !== null);
    await b.store.actions.pick();
    expect(b.model().activation.permissionDenied).toBe(true);
    expect(b.harness.toBackground).toEqual([]);
  });

  it('a later successful pick clears the denied state', async () => {
    const b = await start({ ...withTab, permissions: { acceptPrompt: false, granted: [] } }, {}, seed);
    await b.waitFor((m) => m.activeTab !== null);
    await b.store.actions.pick();
    expect(b.model().activation.permissionDenied).toBe(true);
    const ok = await start(withTab, {}, seed);
    await ok.waitFor((m) => m.activeTab !== null);
    await ok.store.actions.pick();
    expect(ok.model().activation.permissionDenied).toBe(false);
    await ok.store.dispose();
  });

  it('maps remote InjectionFailed and UnsupportedPage to activation state', async () => {
    const b = await start(withTab, {}, seed);
    await b.waitFor((m) => m.activeTab !== null);
    b.harness.failActivation.current = 'InjectionFailed';
    await b.store.actions.pick();
    expect(b.model().activation.injectionFailed).toBe(true);
    b.harness.failActivation.current = 'UnsupportedPage';
    await b.store.actions.pick();
    expect(b.model().activation.unsupported).toBe(true);
  });

  it('parks other failures under the action key', async () => {
    const b = await start(withTab, {}, seed);
    await b.waitFor((m) => m.activeTab !== null);
    b.harness.failActivation.current = 'MessageTimeout';
    await b.store.actions.showNotes();
    expect(b.model().ui.errors.showNotes).toBe('MessageTimeout');
    b.harness.failActivation.current = 'Whatever';
    await b.store.actions.pick();
    expect(b.model().ui.errors.pick).toBe('InvariantViolation');
  });

  it('does nothing without a tab, on unsupported pages, or on origin-less urls', async () => {
    const none = await start({}, {}, seed);
    await none.store.actions.pick();
    expect(none.harness.toBackground).toEqual([]);
    await none.store.dispose();
    const file = await start({ tabs: [mkTab(1, 'file:///tmp/a.html')], activeTabId: tid(1) }, {}, seed);
    await file.waitFor((m) => m.activeTab !== null);
    await file.store.actions.pick();
    expect(file.model().activation.unsupported).toBe(true);
    booted = file;
  });

  it('skips activation on an unsupported page', async () => {
    const b = await start({ tabs: [mkTab(1, 'chrome://extensions')], activeTabId: tid(1) }, {}, seed);
    await b.waitFor((m) => m.activation.unsupported);
    await b.store.actions.pick();
    expect(b.harness.toBackground).toEqual([]);
  });
});

describe('page interaction', () => {
  const seed = {
    sessions: [session],
    settings,
    notes: [pageNote(1)],
    kv: { [activationKey(1)]: { tabId: 1, origin: 'https://example.com', active: true } },
  };
  const ready = async () => {
    const b = await start(withTab, {}, seed);
    await b.waitFor((m) => m.activation.active && m.notes.length === 1);
    b.harness.toContent.length = 0;
    return b;
  };
  const sent = (b: Booted, tag: string) => b.harness.toContent.filter((r) => r._tag === tag);

  it('hover highlights on the page and tracks locally', async () => {
    const b = await ready();
    await b.store.actions.hover(nid(1));
    expect(b.model().hoverNoteId).toBe(nid(1));
    expect(sent(b, 'Highlight')).toEqual([{ _tag: 'Highlight', noteId: nid(1) }]);
    await b.store.actions.hover(null);
    expect(sent(b, 'Highlight').at(-1)).toEqual({ _tag: 'Highlight', noteId: null });
  });

  it('open scrolls to the element and shows the detail view', async () => {
    const b = await ready();
    await b.store.actions.open(nid(1));
    expect(sent(b, 'ScrollTo')).toEqual([{ _tag: 'ScrollTo', noteId: nid(1) }]);
    expect(b.model().ui).toMatchObject({ view: 'detail', detailId: nid(1) });
    expect(b.store.getSnapshot().panel._tag).toBe('Detail');
  });

  it('open still shows the detail when the page cannot scroll', async () => {
    const b = await ready();
    b.harness.failContent.current = true;
    await b.store.actions.open(nid(1));
    expect(b.model().ui.view).toBe('detail');
    expect(b.model().ui.errors.scroll).toBe('ElementNotFound');
  });

  it('does not message the page when Figval is not active there', async () => {
    const b = await start(withTab, {}, { ...seed, kv: {} });
    await b.waitFor((m) => m.notes.length === 1 && m.activeTab !== null);
    await b.store.actions.hover(nid(1));
    await b.store.actions.editOnPage(nid(1));
    expect(b.harness.toContent).toEqual([]);
  });

  it('editOnPage reopens the tooltip', async () => {
    const b = await ready();
    await b.store.actions.editOnPage(nid(1));
    expect(sent(b, 'TooltipReopen')).toEqual([{ _tag: 'TooltipReopen', noteId: nid(1) }]);
  });

  it('before/after sends EditsOff and EditsOn', async () => {
    const b = await ready();
    await b.store.actions.setBeforeAfter('before');
    expect(b.model().ui.beforeAfter).toBe('before');
    expect(sent(b, 'EditsOff')).toHaveLength(1);
    await b.store.actions.setBeforeAfter('after');
    expect(sent(b, 'EditsOn')).toHaveLength(1);
    expect(b.model().ui.beforeAfter).toBe('after');
  });

  it('before/after snaps back when the page does not follow', async () => {
    const b = await ready();
    b.harness.failContent.current = true;
    await b.store.actions.setBeforeAfter('before');
    expect(b.model().ui.beforeAfter).toBe('after');
    expect(b.model().ui.errors.beforeAfter).toBe('ElementNotFound');
  });
});

describe('export', () => {
  const seed = { sessions: [session], settings, notes: [pageNote(1, { comment: 'Make it calmer' }), mkNote(2)] };
  const NOW = Date.UTC(2026, 10, 7, 9, 0, 0);

  it('copies the rendered markdown for the chosen scope and flashes', async () => {
    const b = await start({ ...withTab, now: NOW }, {}, seed);
    await b.waitFor((m) => m.notes.length === 2 && m.activeTab !== null);
    await b.store.actions.setScope('page');
    await b.store.actions.exportCopy();
    const write = (await b.recorded()).find((c) => c.op === 'writeText');
    expect(String(write?.args[0])).toContain('Make it calmer');
    expect(String(write?.args[0])).not.toContain('Button 2');
    expect(b.model().ui.flashId).toBe('export-copy');
    await b.advance(1500);
    await b.waitFor((m) => m.ui.flashId === null);
  });

  it('keeps a ClipboardDenied error so the UI can offer the download', async () => {
    const b = await start({ ...withTab, clipboard: { deny: true } }, {}, seed);
    await b.waitFor((m) => m.notes.length === 2);
    await b.store.actions.exportCopy();
    expect(b.model().ui.errors.export).toBe('ClipboardDenied');
    expect(b.model().ui.flashId).toBeNull();
  });

  it('downloads with the generated filename in the human format', async () => {
    const b = await start({ ...withTab, now: NOW }, {}, seed);
    await b.waitFor((m) => m.notes.length === 2 && m.activeTab !== null);
    await b.store.actions.setFormat('human');
    await b.store.actions.setScope('page');
    await b.store.actions.exportDownload();
    const dl = (await b.recorded()).find((c) => c.op === 'markdown');
    expect(dl?.args[0]).toBe('figval-example.com-register-2026-11-07.md');
    expect(String(dl?.args[1])).toContain('Website review');
  });

  it('does nothing while export is disabled', async () => {
    const b = await start(withTab, {}, seed);
    await b.waitFor((m) => m.notes.length === 2);
    await b.store.actions.setScope('selected');
    await b.store.actions.exportCopy();
    await b.store.actions.exportDownload();
    expect((await b.recorded()).filter((c) => c.service === 'Clipboard' || c.service === 'Download')).toEqual([]);
    await b.store.actions.toggleSelected(nid(2));
    await b.store.actions.exportCopy();
    expect((await b.recorded()).some((c) => c.op === 'writeText')).toBe(true);
  });
});

describe('copy screenshot', () => {
  const shot = nid(50) as never;
  const seed = {
    sessions: [session],
    settings,
    notes: [pageNote(1, { shots: { before: shot, after: null } })],
  };

  it('writes the stored image to the clipboard', async () => {
    const b = await start(withTab, {}, seed);
    await b.waitFor((m) => m.notes.length === 1);
    await runTest(b.store, Effect.flatMap(ShotStore, (s) => s.put(shot, new Blob(['x']))));
    await b.store.actions.copyShot(nid(1), 'before');
    expect((await b.recorded()).some((c) => c.op === 'writeImage')).toBe(true);
    expect(b.model().ui.flashId).toBe(`shot:${nid(1)}:before`);
  });

  it('reports ShotStoreError when there is no shot or the blob is missing', async () => {
    const b = await start(withTab, {}, seed);
    await b.waitFor((m) => m.notes.length === 1);
    await b.store.actions.copyShot(nid(1), 'after');
    expect(b.model().ui.errors.copyShot).toBe('ShotStoreError');
    await b.store.actions.dismissError('copyShot');
    await b.store.actions.copyShot(nid(1), 'before');
    expect(b.model().ui.errors.copyShot).toBe('ShotStoreError');
  });

  it('reports ClipboardDenied for images too', async () => {
    const b = await start({ ...withTab, clipboard: { deny: true } }, {}, seed);
    await b.waitFor((m) => m.notes.length === 1);
    await runTest(b.store, Effect.flatMap(ShotStore, (s) => s.put(shot, new Blob(['x']))));
    await b.store.actions.copyShot(nid(1), 'before');
    expect(b.model().ui.errors.copyShot).toBe('ClipboardDenied');
  });
});

describe('sessions, settings and local UI state', () => {
  const seed = { sessions: [session], settings, notes: [pageNote(1)] };

  it('creates and activates a session, then returns to the list', async () => {
    const b = await start(withTab, {}, seed);
    await b.store.actions.navigate('sessions');
    await b.store.actions.createSession('Review two');
    await b.waitFor((m) => m.sessions.length === 2);
    await b.waitFor((m) => m.settings.activeSessionId !== session.id);
    expect(b.model().ui.view).toBe('list');
    expect(b.harness.toBackground.map((r) => r._tag)).toEqual(['SessionCreate', 'SessionActivate']);
    await b.waitFor((m) => m.notes.length === 0);
  });

  it('creates a session without a name', async () => {
    const b = await start(withTab, {}, seed);
    await b.store.actions.createSession();
    await b.waitFor((m) => m.sessions.length === 2);
    expect(b.harness.toBackground[0]).toEqual({ _tag: 'SessionCreate' });
  });

  it('renames, activates and deletes with a confirmation step', async () => {
    const other = mkSession('bbbb', { name: 'Other' });
    const b = await start(withTab, {}, { ...seed, sessions: [session, other] });
    await b.waitFor((m) => m.sessions.length === 2);
    await b.store.actions.renameSession(other.id, 'Renamed');
    await b.waitFor((m) => m.sessions.some((s) => s.name === 'Renamed'));
    await b.store.actions.requestDeleteSession(other.id);
    expect(b.model().ui.confirmDeleteSession).toBe(other.id);
    await b.store.actions.cancelDeleteSession();
    expect(b.model().ui.confirmDeleteSession).toBeNull();
    await b.store.actions.requestDeleteSession(other.id);
    await b.store.actions.deleteSession(other.id);
    await b.waitFor((m) => m.sessions.length === 1);
    expect(b.model().ui.confirmDeleteSession).toBeNull();
    await b.store.actions.requestDeleteSession(other.id);
    await b.store.actions.activateSession(other.id);
    expect(b.model().ui.confirmDeleteSession).toBeNull();
  });

  it('parks session errors', async () => {
    const b = await start(withTab, {}, seed);
    await b.store.actions.renameSession(mkSession('zzzz').id, 'x');
    expect(b.model().ui.errors.session).toBe('StorageUnavailable');
  });

  it('updates settings through the background', async () => {
    const b = await start(withTab, {}, seed);
    await b.store.actions.updateSettings({ preset: 'developer' });
    await b.waitFor((m) => m.settings.preset === 'developer');
  });

  it('search, filters, format, scope, selection and reorder', async () => {
    const b = await start(withTab, {}, seed);
    const a = b.store.actions;
    await a.setSearch('q');
    await a.toggleType('text');
    await a.toggleIntent('apply');
    await a.toggleNotFound();
    expect(b.model().ui.filters).toMatchObject({ notFound: true });
    expect([...b.model().ui.filters.types]).toEqual(['text']);
    await a.toggleType('text');
    await a.toggleIntent('apply');
    await a.resetFilters();
    expect(b.model().ui.search).toBe('');
    expect(b.model().ui.filters.notFound).toBe(false);
    await a.setFormat('human');
    await a.setScope('page');
    await a.toggleSelected(nid(1));
    expect(b.model().ui).toMatchObject({ format: 'human', scope: 'page' });
    await a.clearSelection();
    await a.navigate('settings');
    expect(b.store.getSnapshot().panel._tag).toBe('Settings');
  });
});

describe('reorder', () => {
  const ordered = { ...session, noteOrder: [nid(1), nid(2)] };
  const seeded = { sessions: [ordered], settings, notes: [pageNote(1), pageNote(2)] };

  it('persists the full order through SessionReorder and clears the local order', async () => {
    const b = await start(withTab, {}, seeded);
    await b.waitFor((m) => m.notes.length === 2);
    await b.store.actions.reorder([nid(2), nid(1)]);
    expect(b.model().ui.localOrder).toBeNull();
    await b.waitFor((m) => m.sessions[0]?.noteOrder[0] === nid(2));
    expect(b.model().sessions[0]?.noteOrder).toEqual([nid(2), nid(1)]);
  });

  it('rolls back and reports reorder when the background fails', async () => {
    const b = await start(withTab, {}, seeded);
    await b.waitFor((m) => m.notes.length === 2);
    b.harness.failBackground.current = 'StorageUnavailable';
    await b.store.actions.reorder([nid(2), nid(1)]);
    expect(b.model().ui.localOrder).toBeNull();
    expect(b.model().ui.errors.reorder).toBe('StorageUnavailable');
    expect(b.model().sessions[0]?.noteOrder).toEqual([nid(1), nid(2)]);
  });

  it('only keeps the optimistic order when there is no active session', async () => {
    const b = await start(withTab, {}, { sessions: [], settings });
    await b.store.actions.reorder([nid(1)]);
    expect(b.model().ui.localOrder).toEqual([nid(1)]);
  });
});

describe('usePanelStore', () => {
  it('re-renders with the latest snapshot and exposes actions', async () => {
    const b = await start(withTab, {}, { sessions: [session], settings });
    const { result } = renderHook(() => usePanelStore(b.store));
    expect(result.current.actions).toBe(b.store.actions);
    await b.store.actions.setSearch('hello');
    await vi.waitFor(() => expect(result.current.model.ui.search).toBe('hello'));
  });
});
