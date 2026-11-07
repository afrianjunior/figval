import { act } from '@testing-library/react';
import { Option, Schema } from 'effect';
import { vi } from 'vitest';
import {
  NoteSeq,
  SessionId,
  TabId,
  defaultSettings,
  emptyEdits,
  type Note,
  type NoteId,
  type Session,
} from '../../domain';
import {
  derivePanelState,
  initialState,
  type ModelState,
  type PanelActions,
  type PanelStore,
  type UiState,
} from '../model';

export const sessionId = (suffix: string): SessionId => Schema.decodeSync(SessionId)(`fv-${suffix}`);
export const noteId = (n: number): NoteId => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}` as NoteId;

export const mkSession = (suffix: string, over: Partial<Session> = {}): Session => ({
  schemaVersion: 1,
  id: sessionId(suffix),
  name: `Session ${suffix}`,
  createdAt: 1,
  updatedAt: 1,
  nextSeq: Schema.decodeSync(NoteSeq)(100),
  noteOrder: [],
  ...over,
});

export const mkNote = (n: number, over: Partial<Note> = {}): Note => ({
  schemaVersion: 1,
  id: noteId(n),
  seq: Schema.decodeSync(NoteSeq)(n),
  sessionId: sessionId('aaaa'),
  createdAt: 1,
  updatedAt: 1,
  page: { url: 'https://example.com/register', title: 'Register', viewport: { w: 1440, h: 900 }, dpr: 2 },
  target: {
    kind: 'element',
    label: `Button ${n}`,
    text: 'Go',
    attrs: {},
    classes: [],
    domPath: [{ tag: 'main', classes: [] }, { tag: 'button', classes: ['cta'], nth: 2 }],
    selector: 'main > button.cta',
    html: '<button class="cta">Go</button>',
    selection: null,
    state: 'rest',
  },
  comment: `Comment ${n}`,
  why: '',
  forceApply: false,
  edits: emptyEdits,
  shots: { before: null, after: null },
  ...over,
});

export const TAB = {
  id: Schema.decodeSync(TabId)(1),
  url: 'https://example.com/register',
  title: 'Register',
};

export const session = mkSession('aaaa', { name: 'Landing revamp' });

/** A model with an active session and the active tab on /register. */
export const baseModel = (over: Partial<ModelState> = {}): ModelState => ({
  ...initialState,
  loaded: { settings: true, sessions: true },
  settings: { ...defaultSettings, activeSessionId: session.id },
  sessions: [session],
  activeTab: TAB,
  activation: { ...initialState.activation, active: true },
  ...over,
});

export const withUi = (model: ModelState, patch: Partial<UiState>): ModelState => ({
  ...model,
  ui: { ...model.ui, ...patch },
});

export interface FakeStore {
  readonly store: PanelStore;
  readonly actions: Record<string, ReturnType<typeof vi.fn>>;
  readonly set: (model: ModelState) => void;
}

/** A PanelStore whose actions are spies and whose snapshot is derived from a hand-made model. */
export const fakeStore = (initial: ModelState): FakeStore => {
  let snapshot = { model: initial, panel: derivePanelState(initial) };
  const listeners = new Set<() => void>();
  const spies: Record<string, ReturnType<typeof vi.fn>> = {};
  const actions = new Proxy({} as Record<string, unknown>, {
    get: (_t, name: string) => (spies[name] ??= vi.fn(() => Promise.resolve())),
  }) as unknown as PanelActions;
  const store = {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    actions,
    ready: Promise.resolve(),
    run: () => Promise.resolve(Option.none()),
    dispose: () => Promise.resolve(),
  } as unknown as PanelStore;
  const set = (model: ModelState) =>
    act(() => {
      snapshot = { model, panel: derivePanelState(model) };
      listeners.forEach((l) => l());
    });
  return { store, actions: spies, set };
};
