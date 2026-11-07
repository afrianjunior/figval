import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useReducer } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { copy } from '../../../copy';
import { baselineFixture } from '../model/fixtures';
import { escapeOutcome } from '../model/selectors';
import { initialState, reduce, type InitOptions, type TooltipState } from '../model/state';
import { defaultTab } from '../model/tab';
import { TooltipView } from './TooltipView';

const t = copy.tooltip;

interface Handlers {
  readonly onSave: () => void;
  readonly onCancel: () => void;
}

const open = (over: Partial<InitOptions> = {}): TooltipState =>
  initialState({
    seq: 2,
    mode: 'new',
    tab: 'comment',
    baseline: baselineFixture,
    similar: { selector: 'button.btn', count: 5 },
    ...over,
  });

function Harness({ init, handlers }: { init: TooltipState; handlers: Handlers }) {
  const [state, dispatch] = useReducer(reduce, init);
  return (
    <TooltipView
      state={state}
      dispatch={dispatch}
      swatches={[]}
      selector="button.btn"
      offscreen={null}
      onSave={handlers.onSave}
      onCancel={handlers.onCancel}
      onRequestClose={handlers.onCancel}
      onTextActive={() => undefined}
      onHoverSimilar={() => undefined}
      onDragMove={() => undefined}
      onDragEnd={() => undefined}
      onResume={() => undefined}
      onDiscardDraft={() => undefined}
    />
  );
}

const setup = (over: Partial<InitOptions> = {}) => {
  const handlers = { onSave: vi.fn(), onCancel: vi.fn() };
  render(<Harness init={open(over)} handlers={handlers} />);
  return handlers;
};

const save = () => screen.getByRole('button', { name: new RegExp(t.actions.save) });

describe('default tab', () => {
  it('opens reviewers on Comment and developers on the last tab', () => {
    expect(defaultTab('reviewer', 'edit')).toBe('comment');
    expect(defaultTab('developer', 'edit')).toBe('edit');
    expect(defaultTab('developer', 'comment')).toBe('comment');
  });
});

describe('TooltipView', () => {
  it('shows the provisional id and a dialog label', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'FV-2' })).toBeInTheDocument();
  });

  it('switches between Comment and Edit tabs', async () => {
    setup();
    expect(screen.getByRole('tab', { name: t.tabs.comment })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await userEvent.click(screen.getByRole('tab', { name: t.tabs.edit }));
    expect(screen.getByRole('tab', { name: t.tabs.edit })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(t.edit.editing('button.btn'))).toBeInTheDocument();
  });

  it('keeps Save disabled until there is a comment or an edit', async () => {
    setup();
    expect(save()).toBeDisabled();
    await userEvent.type(screen.getByPlaceholderText(t.comment.placeholder), 'Make it bigger');
    expect(save()).toBeEnabled();
  });

  it('enables Save after one edit without a comment', async () => {
    setup({ tab: 'edit' });
    expect(save()).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox', { name: t.edit.controls.hide }));
    expect(save()).toBeEnabled();
  });

  it('saves on Ctrl+Enter when allowed', async () => {
    const h = setup();
    const box = screen.getByPlaceholderText(t.comment.placeholder);
    fireEvent.keyDown(box, { key: 'Enter', ctrlKey: true });
    expect(h.onSave).toHaveBeenCalledTimes(1);
    await userEvent.type(box, 'x');
    expect(save()).toBeEnabled();
  });

  it('hides the force-apply checkbox once an edit exists', async () => {
    setup();
    expect(screen.getByRole('checkbox', { name: t.comment.forceApply })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: t.tabs.edit }));
    await userEvent.click(screen.getByRole('checkbox', { name: t.edit.controls.hide }));
    await userEvent.click(screen.getByRole('tab', { name: t.tabs.comment }));
    expect(screen.queryByRole('checkbox', { name: t.comment.forceApply })).toBeNull();
  });

  it('reveals the reason field behind "+ Add reason"', async () => {
    setup();
    expect(screen.queryByPlaceholderText(t.comment.reasonPlaceholder)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: t.comment.addReason }));
    expect(screen.getByPlaceholderText(t.comment.reasonPlaceholder)).toBeInTheDocument();
  });

  it('disables style controls when the element is hidden', async () => {
    setup({ tab: 'edit' });
    const size = screen.getByRole('spinbutton', { name: t.edit.controls.fontSize });
    expect(size).toBeEnabled();
    await userEvent.click(screen.getByRole('checkbox', { name: t.edit.controls.hide }));
    expect(size).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: t.edit.controls.hide })).toBeEnabled();
  });

  it('labels the similar scope with its count', () => {
    setup({ tab: 'edit' });
    expect(screen.getByRole('radio', { name: t.edit.scope.allSimilar(5) })).toBeEnabled();
  });

  it('shows the no-editable-text line for non-text elements', () => {
    setup({ tab: 'edit', baseline: { ...baselineFixture, text: null, hasEditableText: false } });
    expect(screen.getByText(t.edit.noEditableText)).toBeInTheDocument();
  });

  it('shows the matching copy for a save failure and keeps the content', () => {
    const failed = reduce(reduce(open({ comment: 'keep me' }), { type: 'saving' }), {
      type: 'saveFailed',
      tag: 'StorageQuotaExceeded',
    });
    const handlers = { onSave: vi.fn(), onCancel: vi.fn() };
    render(<Harness init={failed} handlers={handlers} />);
    expect(screen.getByRole('alert')).toHaveTextContent(copy.errors.StorageQuotaExceeded);
    expect(screen.getByPlaceholderText(t.comment.placeholder)).toHaveValue('keep me');
    expect(save()).toBeEnabled();
  });

  it('falls back to the generic failure line for unknown tags', () => {
    const failed = reduce(open({ comment: 'x' }), { type: 'saveFailed', tag: 'Weird' });
    render(<Harness init={failed} handlers={{ onSave: vi.fn(), onCancel: vi.fn() }} />);
    expect(screen.getByRole('alert')).toHaveTextContent(t.status.saveFailed);
  });

  it('shows the discard hint after the first Esc on a dirty tooltip', () => {
    const dirty = open({ comment: 'x', edits: undefined });
    const typed = reduce(dirty, { type: 'comment', value: 'xy' });
    expect(escapeOutcome(typed)).toBe('arm');
    const armed = reduce(typed, { type: 'escape' });
    expect(escapeOutcome(armed)).toBe('discard');
    render(<Harness init={armed} handlers={{ onSave: vi.fn(), onCancel: vi.fn() }} />);
    expect(screen.getByText(t.status.discardConfirm)).toBeInTheDocument();
  });

  it('closes on Esc when nothing was entered', () => {
    expect(escapeOutcome(open())).toBe('close');
  });

  it('disables the Edit tab and explains when the element is gone', () => {
    const gone = reduce(open({ tab: 'edit' }), { type: 'elementStatus', value: 'gone' });
    render(<Harness init={gone} handlers={{ onSave: vi.fn(), onCancel: vi.fn() }} />);
    expect(screen.getByRole('tab', { name: t.tabs.edit })).toBeDisabled();
    expect(screen.getByText(t.status.elementGone)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(t.comment.placeholder)).toBeInTheDocument();
  });

  it('offers to resume a stored draft', () => {
    const resumable = open({
      resume: {
        seq: 8,
        snapshot: {
          label: '',
          comment: 'old',
          why: '',
          showWhy: false,
          forceApply: false,
          tab: 'comment',
          text: null,
          style: {},
          hidden: false,
          scope: 'this',
        },
      },
    });
    render(<Harness init={resumable} handlers={{ onSave: vi.fn(), onCancel: vi.fn() }} />);
    expect(screen.getByText(t.draft.resume('FV-8'))).toBeInTheDocument();
  });

  it('wires Cancel to the handler', async () => {
    const h = setup();
    await userEvent.click(screen.getByRole('button', { name: new RegExp(t.actions.cancel) }));
    expect(h.onCancel).toHaveBeenCalled();
  });
});

describe('Edit tab accessible names', () => {
  const edit = () => setup({ tab: 'edit' });

  it('names the color row parts with their own strings', () => {
    edit();
    expect(screen.getAllByRole('button', { name: t.edit.colorRow.openPicker })).toHaveLength(2);
    expect(screen.getAllByRole('textbox', { name: t.edit.colorRow.hexField })).toHaveLength(2);
  });

  it('names the picker group and page swatches after opening', async () => {
    edit();
    await userEvent.click(screen.getAllByRole('button', { name: t.edit.colorRow.openPicker })[0]!);
    expect(screen.getByRole('group', { name: t.edit.colorRow.picker })).toBeInTheDocument();
  });

  it('shows the short handle text while keeping the full accessible name', () => {
    edit();
    const handles = screen.getAllByTestId('scrub-handle').map((n) => n.textContent);
    expect(handles).toEqual([
      t.edit.handles.fontSize,
      t.edit.handles.paddingVertical,
      t.edit.handles.paddingHorizontal,
      t.edit.handles.radius,
    ]);
    for (const name of [
      t.edit.controls.fontSize,
      t.edit.controls.paddingVertical,
      t.edit.controls.paddingHorizontal,
      t.edit.controls.radius,
    ]) {
      expect(screen.getByRole('spinbutton', { name })).toBeInTheDocument();
    }
  });

  it('labels font weight options with their names', () => {
    edit();
    const select = screen.getByRole('combobox', { name: t.edit.controls.fontWeight });
    const labels = [...select.querySelectorAll('option')].map((o) => o.textContent);
    expect(labels).toContain('400 Regular');
    expect(labels).toContain('600 Semibold');
  });

  it('adds an unnamed weight as a bare number', () => {
    setup({
      tab: 'edit',
      baseline: {
        ...baselineFixture,
        style: { ...baselineFixture.style, 'font-weight': '450' },
      },
    });
    const select = screen.getByRole('combobox', { name: t.edit.controls.fontWeight });
    expect([...select.querySelectorAll('option')].map((o) => o.textContent)).toContain('450');
  });
});

describe('tooltip.css motion and dividers', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/content/tooltip/tooltip.css'), 'utf8');

  it('drops the rise animation under reduced motion', () => {
    const block = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    expect(block).toMatch(/\.fv-tip\s*\{[^}]*animation:\s*none/);
  });

  it('keeps a hairline above the first fields section', () => {
    expect(css).toMatch(
      /\.fv-tip__fields > \.fv-section:first-child\s*\{[^}]*border-top: 1px solid/,
    );
  });
});
