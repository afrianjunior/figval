import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { copy } from '../../copy';
import { initialWelcome, type WelcomeState, type WelcomeStore } from '../model';
import { WelcomeApp } from './WelcomeApp';

const t = copy.welcome;

const fakeStore = (state: Partial<WelcomeState>): WelcomeStore => {
  const snapshot = { ...initialWelcome, loaded: true, shortcut: 'Alt+Shift+F', ...state };
  return {
    getSnapshot: () => snapshot,
    subscribe: () => () => undefined,
    actions: { choosePreset: vi.fn(() => Promise.resolve()), openExample: vi.fn(() => Promise.resolve()), openShortcuts: vi.fn(() => Promise.resolve()) },
    ready: Promise.resolve(),
    run: vi.fn() as never,
    dispose: () => Promise.resolve(),
  };
};

describe('WelcomeApp', () => {
  it('shows the three steps with progress and the assigned shortcut', () => {
    render(<WelcomeApp store={fakeStore({})} />);
    expect(screen.getByRole('heading', { level: 1, name: t.title })).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText(t.progress(0, 3))).toBeTruthy();
    expect(screen.getByText('Alt+Shift+F')).toBeTruthy();
    expect(screen.queryByText(t.tryIt.noShortcut)).toBeNull();
  });

  it('marks finished steps for screen readers and counts them', () => {
    render(<WelcomeApp store={fakeStore({ pinned: true, presetChosen: true, hasNotes: true })} />);
    expect(screen.getByText(t.progress(3, 3))).toBeTruthy();
    expect(screen.getByRole('heading', { name: `${t.pin.title} (${t.stepDone})` })).toBeTruthy();
    expect(screen.getByText(t.pin.pinned)).toBeTruthy();
  });

  it('saves the preset picked from the radio cards', () => {
    const store = fakeStore({});
    render(<WelcomeApp store={store} />);
    fireEvent.click(screen.getByRole('radio', { name: new RegExp(t.role.developer.label) }));
    expect(store.actions.choosePreset).toHaveBeenCalledWith('developer');
    expect((screen.getByRole('radio', { name: new RegExp(t.role.reviewer.label) }) as HTMLInputElement).checked).toBe(true);
  });

  it('offers to set a shortcut when Chrome left it unassigned', () => {
    const store = fakeStore({ shortcut: '' });
    render(<WelcomeApp store={store} />);
    fireEvent.click(screen.getByRole('button', { name: t.tryIt.setShortcut }));
    expect(store.actions.openShortcuts).toHaveBeenCalled();
  });

  it('opens the example page and reports a failed save', () => {
    const store = fakeStore({ saveFailed: true });
    render(<WelcomeApp store={store} />);
    fireEvent.click(screen.getByRole('button', { name: t.tryIt.openExample }));
    expect(store.actions.openExample).toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe(t.role.saveFailed);
  });
});
