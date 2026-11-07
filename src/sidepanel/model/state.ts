import { defaultSettings, type ErrorTag, type Note, type NoteId, type NoteTag, type Intent, type Session, type SessionId, type Settings, type TabId } from '../../domain';

export type PanelView = 'list' | 'detail' | 'sessions' | 'settings';
export type ExportFormatChoice = 'llm' | 'human';
export type ExportScope = 'all' | 'page' | 'selected' | 'filtered';
export type BeforeAfter = 'after' | 'before';

/** Keys under which a failed action parks its error tag; the UI shows it next to that action. */
export type ErrorKey =
  | 'pick'
  | 'showNotes'
  | 'export'
  | 'copyShot'
  | 'session'
  | 'settings'
  | 'beforeAfter'
  | 'delete'
  | 'reorder'
  | 'markers'
  | 'scroll'
  | 'edit'
  | 'storage'
  | `note:${string}`;

export interface ActiveTab {
  readonly id: TabId;
  readonly url: string;
  readonly title: string;
}

export interface ActivationState {
  readonly active: boolean;
  readonly unsupported: boolean;
  readonly permissionDenied: boolean;
  readonly injectionFailed: boolean;
}

export interface Filters {
  readonly types: ReadonlySet<NoteTag>;
  readonly intents: ReadonlySet<Intent>;
  readonly notFound: boolean;
}

export interface PendingDelete {
  readonly id: NoteId;
  readonly until: number;
}

export interface UiState {
  readonly view: PanelView;
  readonly detailId: NoteId | null;
  readonly search: string;
  readonly filters: Filters;
  readonly format: ExportFormatChoice;
  readonly scope: ExportScope;
  readonly selectedIds: ReadonlySet<NoteId>;
  readonly pendingDelete: PendingDelete | null;
  readonly beforeAfter: BeforeAfter;
  readonly errors: Readonly<Partial<Record<ErrorKey, ErrorTag>>>;
  readonly flashId: string | null;
  /** Local-only drag order until the protocol gains SessionReorder. */
  readonly localOrder: readonly NoteId[] | null;
  readonly confirmDeleteSession: SessionId | null;
}

/** pageKey -> note count, per session; feeds "notes in another session" and the sessions list. */
export type SessionPageCounts = Readonly<Record<string, Readonly<Record<string, number>>>>;

export interface ModelState {
  readonly loaded: { readonly settings: boolean; readonly sessions: boolean };
  readonly settings: Settings;
  readonly sessions: readonly Session[];
  readonly notes: readonly Note[];
  readonly corruptCount: number;
  readonly activeTab: ActiveTab | null;
  readonly activation: ActivationState;
  readonly missingIds: readonly NoteId[];
  readonly hoverNoteId: NoteId | null;
  readonly sessionPageCounts: SessionPageCounts;
  readonly ui: UiState;
}

export const emptyFilters: Filters = { types: new Set(), intents: new Set(), notFound: false };

export const initialActivation: ActivationState = {
  active: false,
  unsupported: false,
  permissionDenied: false,
  injectionFailed: false,
};

export const initialState: ModelState = {
  loaded: { settings: false, sessions: false },
  settings: defaultSettings,
  sessions: [],
  notes: [],
  corruptCount: 0,
  activeTab: null,
  activation: initialActivation,
  missingIds: [],
  hoverNoteId: null,
  sessionPageCounts: {},
  ui: {
    view: 'list',
    detailId: null,
    search: '',
    filters: emptyFilters,
    format: 'llm',
    scope: 'all',
    selectedIds: new Set(),
    pendingDelete: null,
    beforeAfter: 'after',
    errors: {},
    flashId: null,
    localOrder: null,
    confirmDeleteSession: null,
  },
};

export const activeSessionOf = (state: Pick<ModelState, 'settings' | 'sessions'>): Session | null =>
  state.sessions.find((s) => s.id === state.settings.activeSessionId) ?? null;

export const withUi = (state: ModelState, patch: Partial<UiState>): ModelState => ({
  ...state,
  ui: { ...state.ui, ...patch },
});

export const withError = (state: ModelState, key: ErrorKey, tag: ErrorTag): ModelState =>
  withUi(state, { errors: { ...state.ui.errors, [key]: tag } });

export const withoutErrors = (state: ModelState, keys: readonly ErrorKey[]): ModelState => {
  if (!keys.some((k) => k in state.ui.errors)) return state;
  const rest = Object.fromEntries(Object.entries(state.ui.errors).filter(([k]) => !keys.includes(k as ErrorKey)));
  return withUi(state, { errors: rest });
};

export const withoutError = (state: ModelState, key: ErrorKey): ModelState => withoutErrors(state, [key]);

export const toggled = <A>(set: ReadonlySet<A>, value: A): ReadonlySet<A> => {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
};
