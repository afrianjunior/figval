import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { copy } from '../../copy';
import { defaultSettings } from '../../domain';
import { initialState } from '../model';
import { App } from './App';
import { baseModel, fakeStore, mkNote, mkSession, noteId, session, sessionId, withUi } from './test-support';

const t = copy.panel;

const mount = (model = baseModel()) => {
  const fake = fakeStore(model);
  render(<App store={fake.store} />);
  return fake;
};

const home = (n: number) =>
  mkNote(n, { page: { url: 'https://example.com/', title: 'Home', viewport: { w: 1, h: 1 }, dpr: 1 } });

describe('PanelState variants', () => {
  it('Loading shows a busy skeleton and no controls', () => {
    mount(initialState);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent(t.states.loading);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('FirstRun shows the line, a large Pick button and a disabled export', () => {
    mount(baseModel({ settings: defaultSettings, sessions: [] }));
    expect(screen.getByText(t.states.firstRun.line)).toBeVisible();
    expect(screen.getByText(t.header.noSession)).toBeVisible();
    expect(screen.getByRole('button', { name: new RegExp(t.states.firstRun.cta) })).toBeEnabled();
    expect(screen.getByRole('button', { name: t.footer.copyMarkdown })).toBeDisabled();
  });

  it('FirstRun on an unsupported page replaces the Pick button with the message', () => {
    mount(
      baseModel({
        settings: defaultSettings,
        sessions: [],
        activation: { ...initialState.activation, unsupported: true },
      }),
    );
    expect(screen.getByText(t.states.unsupported.line)).toBeVisible();
    expect(screen.queryByRole('button', { name: new RegExp(t.states.firstRun.cta) })).toBeNull();
  });

  it('EmptySession shows the empty line with export disabled', () => {
    mount();
    expect(screen.getByText(t.states.emptySession.line)).toBeVisible();
    expect(screen.getByRole('button', { name: t.footer.download })).toBeDisabled();
    expect(screen.getByText(t.header.sessionTitle('Landing revamp', 0))).toBeVisible();
  });

  it('Ready groups notes by page, current page first and open', () => {
    mount(baseModel({ notes: [home(1), mkNote(2), mkNote(3)] }));
    const groups = screen.getAllByRole('region');
    expect(within(groups[0]!).getByText(t.list.groupThisPage)).toBeVisible();
    expect(within(groups[0]!).getByText('FV-2')).toBeVisible();
    expect(within(groups[1]!).getByText('FV-1')).toBeVisible();
    expect(screen.getByRole('button', { name: t.footer.copyMarkdown })).toBeEnabled();
  });

  it('Ready flags an empty current page with one muted line', () => {
    mount(baseModel({ notes: [home(1)] }));
    expect(screen.getByText(t.states.emptyCurrentPage.line)).toBeVisible();
  });

  it('Detail shows the title, comment, changes, screenshot placeholder and locator', () => {
    const note = mkNote(5, {
      why: 'Too loud',
      edits: {
        ...mkNote(5).edits,
        text: { before: 'Daftar', after: 'Mulai gratis' },
        style: [{ property: 'background-color', before: '#FF2D55', after: '#0F62FE' }],
      },
    });
    const model = withUi(
      baseModel({
        notes: [note],
        settings: { ...defaultSettings, preset: 'developer', activeSessionId: session.id },
      }),
      { view: 'detail', detailId: note.id },
    );
    mount(model);
    expect(screen.getByRole('heading', { name: t.detail.title('FV-5', 'Button 5') })).toHaveFocus();
    expect(screen.getByLabelText(t.detail.comment)).toHaveValue('Comment 5');
    expect(screen.getByLabelText(t.detail.why)).toHaveValue('Too loud');
    expect(screen.getByText(t.detail.textChange('Daftar', 'Mulai gratis'))).toBeVisible();
    const fill = screen.getByRole('region', { name: t.detail.changeGroups.fill });
    expect(within(fill).getByRole('group', { name: copy.tooltip.edit.controls.background })).toHaveTextContent(`#FF2D55→${t.detail.changeTo}#0F62FE`);
    expect(screen.getByRole('region', { name: t.detail.changeGroups.text })).toBeVisible();
    expect(screen.queryByRole('region', { name: t.detail.changeGroups.layout })).toBeNull();
    expect(screen.getByText(t.detail.scopeOne)).toBeVisible();
    expect(screen.getByText(t.detail.noScreenshot)).toBeVisible();
    expect(screen.queryByLabelText(t.detail.letAgentApply)).toBeNull();
    expect(screen.getByText('main > button.cta')).toBeVisible();
  });

  it('Detail groups color, padding and hidden into Fill, Layout and Visibility sections', () => {
    const base = mkNote(6);
    const note = mkNote(6, {
      target: { ...base.target, state: 'hover' },
      edits: {
        ...base.edits,
        hidden: true,
        style: [
          { property: 'color', before: '#111111', after: '#222222' },
          { property: 'padding-block', before: '4px', after: '8px' },
        ],
      },
    });
    mount(withUi(baseModel({ notes: [note] }), { view: 'detail', detailId: note.id }));
    const names = screen
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent)
      .filter((name) => name !== t.detail.screenshot);
    expect(names).toEqual([
      t.detail.changeGroups.fill,
      t.detail.changeGroups.layout,
      t.detail.changeGroups.visibility,
    ]);
    const layout = screen.getByRole('region', { name: t.detail.changeGroups.layout });
    expect(within(layout).getByRole('group', { name: copy.tooltip.edit.controls.paddingVertical })).toHaveTextContent(`4px→${t.detail.changeTo}8px`);
    expect(screen.queryByRole('region', { name: t.detail.changeGroups.typography })).toBeNull();
    expect(screen.getByText(t.detail.scopeOne)).toBeVisible();
  });

  it('Detail meta shows path, viewport and the target state', () => {
    const base = mkNote(7);
    const note = mkNote(7, { target: { ...base.target, state: 'focus' } });
    mount(withUi(baseModel({ notes: [note] }), { view: 'detail', detailId: note.id }));
    expect(screen.getByText(t.detail.meta('/register', 1440, 900, 'focus'))).toBeVisible();
  });

  it('Detail labels each locator block', () => {
    const note = mkNote(8);
    mount(withUi(baseModel({ notes: [note] }), { view: 'detail', detailId: note.id }));
    const { domPath, selector, html } = t.detail.locatorParts;
    for (const label of [domPath, selector, html]) expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('Detail keeps the locator closed for the reviewer preset', () => {
    const note = mkNote(5);
    mount(withUi(baseModel({ notes: [note] }), { view: 'detail', detailId: note.id }));
    expect(screen.getByText(t.detail.locator).closest('details')).not.toHaveAttribute('open');
  });

  it('Sessions lists sessions with the active one marked', () => {
    const other = mkSession('bbbb', { name: 'Checkout', updatedAt: 5 });
    mount(withUi(baseModel({ sessions: [session, other] }), { view: 'sessions' }));
    expect(screen.getByRole('heading', { name: t.sessions.title })).toHaveFocus();
    expect(screen.getByRole('button', { current: true })).toHaveTextContent('Landing revamp');
    expect(screen.getByRole('button', { name: t.sessions.newSession })).toBeVisible();
  });

  it('Settings shows preset, screenshots and the corrupt count', () => {
    mount(withUi({ ...baseModel(), corruptCount: 2 }, { view: 'settings' }));
    expect(screen.getByRole('heading', { name: t.settings.title })).toHaveFocus();
    expect(screen.getByRole('radio', { name: t.settings.presets.reviewer })).toBeChecked();
    expect(screen.getByLabelText(t.settings.screenshots)).toBeChecked();
    expect(screen.getByText(t.settings.corrupt(2))).toBeVisible();
  });
});

describe('strip, search, toolbar and footer states', () => {
  it('NotActivated strip offers Show', async () => {
    const fake = mount(baseModel({ notes: [mkNote(1)], activation: initialState.activation }));
    expect(screen.getByText(t.states.notActivated.strip(1))).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: t.states.notActivated.action }));
    expect(fake.actions.showNotes).toHaveBeenCalledTimes(1);
  });

  it('OtherSession strip offers Open', async () => {
    const other = mkSession('bbbb', { name: 'Checkout' });
    const elsewhere = { ...mkNote(9), sessionId: sessionId('bbbb') };
    void elsewhere;
    const fake = mount(
      baseModel({
        sessions: [session, other],
        notes: [home(1)],
        sessionPageCounts: { [other.id]: { 'example.com/register': 3 } },
      }),
    );
    expect(screen.getByText(t.states.otherSession.strip(3, 'Checkout'))).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: t.states.otherSession.action }));
    expect(fake.actions.activateSession).toHaveBeenCalledWith(other.id);
  });

  it('shows search once the session has enough notes and filters through actions', async () => {
    const notes = [1, 2, 3, 4, 5].map((n) => mkNote(n));
    const fake = mount(baseModel({ notes }));
    expect(screen.getByRole('textbox', { name: t.search.placeholder })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: t.search.chips.style }));
    expect(fake.actions.toggleType).toHaveBeenCalledWith('style');
    await userEvent.click(screen.getByRole('button', { name: t.search.chips.propose }));
    expect(fake.actions.toggleIntent).toHaveBeenCalledWith('propose');
  });

  it('hides search below the threshold', () => {
    mount(baseModel({ notes: [mkNote(1)] }));
    expect(screen.queryByRole('textbox', { name: t.search.placeholder })).toBeNull();
  });

  it('Cmd/Ctrl+F focuses the search box', async () => {
    mount(baseModel({ notes: [1, 2, 3, 4, 5].map((n) => mkNote(n)) }));
    await userEvent.keyboard('{Control>}f{/Control}');
    expect(screen.getByRole('textbox', { name: t.search.placeholder })).toHaveFocus();
  });

  it('noResults with only filters says so without quoting anything', () => {
    const notes = [1, 2, 3, 4, 5].map((n) => mkNote(n));
    const model = baseModel({ notes });
    mount(withUi(model, { filters: { ...model.ui.filters, notFound: true } }));
    expect(screen.getByText(t.states.noResults.filterLine)).toBeVisible();
  });

  it('noResults shows the query and a Reset filters button', async () => {
    const notes = [1, 2, 3, 4, 5].map((n) => mkNote(n));
    const fake = mount(withUi(baseModel({ notes }), { search: 'zzz' }));
    expect(screen.getByText(t.states.noResults.line('zzz'))).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: t.states.noResults.reset }));
    expect(fake.actions.resetFilters).toHaveBeenCalled();
  });

  it('unsupported pages replace the toolbar with the message while the list stays', () => {
    mount(
      baseModel({
        notes: [home(1)],
        activeTab: { ...baseModel().activeTab!, url: 'chrome://extensions' },
        activation: { ...initialState.activation, unsupported: true },
      }),
    );
    expect(screen.getByText(t.states.unsupported.line)).toBeVisible();
    expect(screen.queryByRole('button', { name: new RegExp(t.toolbar.pick) })).toBeNull();
    expect(screen.getByText('FV-1')).toBeVisible();
  });

  it('permission declined shows its helper text and a retry that picks again', async () => {
    const fake = mount(baseModel({ activation: { ...initialState.activation, permissionDenied: true } }));
    expect(screen.getByText(t.toolbar.helper.permissionDeclined)).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: t.toolbar.retry }));
    expect(fake.actions.pick).toHaveBeenCalled();
  });

  it('Selected scope with nothing checked disables export and shows the hint', () => {
    const fake = mount(withUi(baseModel({ notes: [mkNote(1), mkNote(2)] }), { scope: 'selected' }));
    expect(fake.store.getSnapshot().panel._tag).toBe('Ready');
    expect(screen.getByText(t.states.exportNothingSelected.hint)).toBeVisible();
    expect(screen.getByRole('button', { name: t.footer.copyMarkdown })).toBeDisabled();
    expect(screen.getAllByRole('checkbox', { name: new RegExp('FV-') })).toHaveLength(2);
  });

  it('copy and download run the export actions', async () => {
    const fake = mount(baseModel({ notes: [mkNote(1)] }));
    await userEvent.click(screen.getByRole('button', { name: t.footer.copyMarkdown }));
    await userEvent.click(screen.getByRole('button', { name: t.footer.download }));
    expect(fake.actions.exportCopy).toHaveBeenCalledTimes(1);
    expect(fake.actions.exportDownload).toHaveBeenCalledTimes(1);
  });

  it('offers Filter results only while a filter is active', () => {
    mount(withUi(baseModel({ notes: [mkNote(1)] }), { search: 'Button' }));
    expect(screen.getByRole('option', { name: t.footer.scope.filtered(1) })).toBeInTheDocument();
  });
});

describe('keyboard, toasts and dialog', () => {
  it('arrow keys move between rows, Enter opens, Delete deletes', async () => {
    const fake = mount(baseModel({ notes: [mkNote(1), mkNote(2)] }));
    const buttons = screen.getAllByRole('button', { name: new RegExp('Button') });
    buttons[0]!.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(buttons[1]).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(buttons[0]).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(fake.actions.open).toHaveBeenCalledWith(noteId(1));
    await userEvent.keyboard('{Delete}');
    expect(fake.actions.deleteNote).toHaveBeenCalledWith(noteId(1));
  });

  it('Delete moves focus to the next row, then the previous, then the group heading', async () => {
    const fake = mount(baseModel({ notes: [mkNote(1), mkNote(2)] }));
    const buttons = screen.getAllByRole('button', { name: new RegExp('Button') });
    buttons[0]!.focus();
    await userEvent.keyboard('{Delete}');
    expect(buttons[1]).toHaveFocus();
    await userEvent.keyboard('{Delete}');
    expect(buttons[0]).toHaveFocus();
    expect(fake.actions.deleteNote).toHaveBeenCalledTimes(2);
  });

  it('Delete on the only row focuses the group heading', async () => {
    mount(baseModel({ notes: [mkNote(1)] }));
    screen.getByRole('button', { name: new RegExp('Button') }).focus();
    await userEvent.keyboard('{Delete}');
    expect(screen.getByRole('heading', { level: 3, name: new RegExp(t.list.groupThisPage) })).toHaveFocus();
  });

  it('Cmd/Ctrl+Z undoes a pending delete and does nothing otherwise', async () => {
    const idle = mount(baseModel({ notes: [mkNote(1)] }));
    await userEvent.keyboard('{Control>}z{/Control}');
    expect(idle.actions.undoDelete?.mock.calls ?? []).toHaveLength(0);
  });

  it('Cmd/Ctrl+Z calls undoDelete while a delete is pending', async () => {
    const fake = mount(withUi(baseModel({ notes: [mkNote(1)] }), { pendingDelete: { id: noteId(1), until: 5000 } }));
    await userEvent.keyboard('{Control>}z{/Control}');
    expect(fake.actions.undoDelete).toHaveBeenCalledTimes(1);
  });

  it('the toast region is a polite live region', () => {
    const { container } = render(<App store={fakeStore(baseModel({ notes: [mkNote(1)] })).store} />);
    expect(container.querySelector('.fvp-toasts')).toHaveAttribute('aria-live', 'polite');
  });

  it('Pick button shows the Mac glyphs on Mac and Alt+Shift+F elsewhere', () => {
    const ua = vi.spyOn(navigator, 'userAgent', 'get');
    ua.mockReturnValue('Mozilla/5.0 (Macintosh; Intel Mac OS X)');
    const { unmount } = render(<App store={fakeStore(baseModel()).store} />);
    expect(screen.getByText(copy.keys.toggleShortcut)).toBeVisible();
    unmount();
    ua.mockReturnValue('Mozilla/5.0 (Windows NT 10.0)');
    render(<App store={fakeStore(baseModel()).store} />);
    expect(screen.getByText(copy.keys.toggleShortcutOther)).toBeVisible();
    ua.mockRestore();
  });

  it('Alt+Arrow reorders a row through the model', async () => {
    const fake = mount(baseModel({ notes: [mkNote(1), mkNote(2)] }));
    screen.getAllByRole('button', { name: new RegExp('Button') })[0]!.focus();
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(fake.actions.reorder).toHaveBeenCalledWith([noteId(2), noteId(1)]);
  });

  it('moving one row of three sends the whole group in its new order', async () => {
    const fake = mount(baseModel({ notes: [mkNote(1), mkNote(2), mkNote(3)] }));
    screen.getAllByRole('button', { name: new RegExp('Button') })[1]!.focus();
    await userEvent.keyboard('{Alt>}{ArrowUp}{/Alt}');
    expect(fake.actions.reorder).toHaveBeenCalledWith([noteId(2), noteId(1), noteId(3)]);
  });

  it('a row moved in one group keeps every other visible id in the call', async () => {
    const fake = mount(baseModel({ notes: [mkNote(1), mkNote(2), home(3)] }));
    screen.getAllByRole('button', { name: new RegExp('Button') })[0]!.focus();
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');
    const [ids] = fake.actions.reorder!.mock.calls[0]! as [readonly string[]];
    expect([...ids].sort()).toEqual([noteId(1), noteId(2), noteId(3)].sort());
    expect(ids.indexOf(noteId(2))).toBeLessThan(ids.indexOf(noteId(1)));
  });

  it('an error toast closes with its Dismiss button', async () => {
    const fake = mount(withUi(baseModel({ notes: [mkNote(1)] }), { errors: { export: 'ClipboardDenied' } }));
    await userEvent.click(screen.getByRole('button', { name: copy.toasts.dismiss }));
    expect(fake.actions.dismissError).toHaveBeenCalledWith('export');
  });

  it('Esc leaves a drill-in', async () => {
    const note = mkNote(1);
    const fake = mount(withUi(baseModel({ notes: [note] }), { view: 'detail', detailId: note.id }));
    await userEvent.keyboard('{Escape}');
    expect(fake.actions.back).toHaveBeenCalled();
  });

  it('a pending delete shows the Deleted toast with Undo', async () => {
    const fake = mount(withUi(baseModel({ notes: [mkNote(1)] }), { pendingDelete: { id: noteId(1), until: 5000 } }));
    expect(screen.getByText(copy.toasts.deleted)).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: copy.toasts.undo }));
    expect(fake.actions.undoDelete).toHaveBeenCalled();
  });

  it('clipboard denied offers a download instead', async () => {
    const fake = mount(withUi(baseModel({ notes: [mkNote(1)] }), { errors: { export: 'ClipboardDenied' } }));
    expect(screen.getByText(copy.toasts.clipboardDenied)).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: copy.toasts.clipboardDeniedAction }));
    expect(fake.actions.exportDownload).toHaveBeenCalled();
  });

  it('copied and downloaded flashes show their toast', () => {
    mount(withUi(baseModel({ notes: [mkNote(1)] }), { flashId: 'export-download' }));
    expect(screen.getByText(copy.toasts.downloaded)).toBeVisible();
  });

  it('deleting a session asks first, then deletes on confirm', async () => {
    const other = mkSession('bbbb', { name: 'Checkout' });
    const fake = mount(withUi(baseModel({ sessions: [session, other] }), { view: 'sessions', confirmDeleteSession: other.id }));
    const dialog = screen.getByRole('dialog', { name: t.sessions.deleteDialog.title('Checkout') });
    expect(within(dialog).getByText(t.sessions.deleteDialog.body(0))).toBeVisible();
    await userEvent.click(within(dialog).getByRole('button', { name: t.sessions.deleteDialog.confirm }));
    expect(fake.actions.deleteSession).toHaveBeenCalledWith(other.id);
    await userEvent.keyboard('{Escape}');
    expect(fake.actions.cancelDeleteSession).toHaveBeenCalled();
  });

  it('typing in the detail comment saves through updateNote', async () => {
    const note = mkNote(1, { comment: '' });
    const fake = mount(withUi(baseModel({ notes: [note] }), { view: 'detail', detailId: note.id }));
    await userEvent.type(screen.getByLabelText(t.detail.comment), 'hi');
    expect(fake.actions.updateNote).toHaveBeenLastCalledWith(note.id, { comment: 'hi' });
  });

  it('the detail menu and delete button call their actions', async () => {
    const note = mkNote(1);
    const fake = mount(withUi(baseModel({ notes: [note] }), { view: 'detail', detailId: note.id }));
    await userEvent.click(screen.getByRole('button', { name: t.detail.editOnPage }));
    expect(fake.actions.editOnPage).toHaveBeenCalledWith(note.id);
    await userEvent.click(screen.getByRole('button', { name: t.detail.deleteNote }));
    expect(fake.actions.deleteNote).toHaveBeenCalledWith(note.id);
  });

  it('the header menu opens Settings and returns focus to its button on Back', async () => {
    const fake = mount(baseModel({ notes: [mkNote(1)] }));
    await userEvent.click(screen.getByRole('button', { name: t.header.menuLabel }));
    await userEvent.click(screen.getByRole('menuitem', { name: t.header.menu.settings }));
    expect(fake.actions.navigate).toHaveBeenCalledWith('settings');
  });

  it('returns focus to the originating row after a drill-in', async () => {
    const notes = [mkNote(1), mkNote(2)];
    const fake = mount(baseModel({ notes }));
    const second = screen.getAllByRole('button', { name: new RegExp('Button') })[1]!;
    await userEvent.click(second);
    fake.set(withUi(baseModel({ notes }), { view: 'detail', detailId: noteId(2) }));
    expect(screen.getByRole('heading', { name: t.detail.title('FV-2', 'Button 2') })).toHaveFocus();
    fake.set(baseModel({ notes }));
    expect(screen.getAllByRole('button', { name: new RegExp('Button') })[1]).toHaveFocus();
  });
});
