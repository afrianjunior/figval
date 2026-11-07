import { Effect } from 'effect';
import { Messenger, type MessengerService } from '../../messaging';
import type { Intent, NoteId, NoteTag, SessionId } from '../../domain';
import type { SettingsPatch } from '../../messaging';
import { clearError, failTo, update, type Ctx } from './context';
import {
  emptyFilters,
  toggled,
  withUi,
  type ExportFormatChoice,
  type ExportScope,
  type ModelState,
  type PanelView,
} from './state';

const ui = (ctx: Ctx, patch: Parameters<typeof withUi>[1]): Effect.Effect<void> =>
  update(ctx, (s) => withUi(s, patch));

const uiWith = (ctx: Ctx, f: (s: ModelState) => Parameters<typeof withUi>[1]): Effect.Effect<void> =>
  update(ctx, (s) => withUi(s, f(s)));

export const navigate = (ctx: Ctx, view: PanelView): Effect.Effect<void> =>
  ui(ctx, { view, detailId: null, confirmDeleteSession: null });

/** Drill-in screens go back to the list. */
export const back = (ctx: Ctx): Effect.Effect<void> => navigate(ctx, 'list');

export const setSearch = (ctx: Ctx, search: string) => ui(ctx, { search });
export const toggleType = (ctx: Ctx, tag: NoteTag) =>
  uiWith(ctx, (s) => ({ filters: { ...s.ui.filters, types: toggled(s.ui.filters.types, tag) } }));
export const toggleIntent = (ctx: Ctx, intent: Intent) =>
  uiWith(ctx, (s) => ({ filters: { ...s.ui.filters, intents: toggled(s.ui.filters.intents, intent) } }));
export const toggleNotFound = (ctx: Ctx) =>
  uiWith(ctx, (s) => ({ filters: { ...s.ui.filters, notFound: !s.ui.filters.notFound } }));
export const resetFilters = (ctx: Ctx) => ui(ctx, { search: '', filters: emptyFilters });
export const setFormat = (ctx: Ctx, format: ExportFormatChoice) => ui(ctx, { format });
export const setScope = (ctx: Ctx, scope: ExportScope) => ui(ctx, { scope });
export const toggleSelected = (ctx: Ctx, id: NoteId) =>
  uiWith(ctx, (s) => ({ selectedIds: toggled(s.ui.selectedIds, id) }));
export const clearSelection = (ctx: Ctx) => ui(ctx, { selectedIds: new Set() });
export const requestDeleteSession = (ctx: Ctx, id: SessionId) => ui(ctx, { confirmDeleteSession: id });
export const cancelDeleteSession = (ctx: Ctx) => ui(ctx, { confirmDeleteSession: null });
export const dismissError = (ctx: Ctx, key: Parameters<typeof clearError>[1]) => clearError(ctx, key);

const viaBackground = (
  ctx: Ctx,
  send: (m: MessengerService) => Effect.Effect<unknown, unknown>,
  key: 'session' | 'settings',
): Effect.Effect<void, never, Messenger> =>
  Effect.gen(function* () {
    yield* send(yield* Messenger);
    yield* clearError(ctx, key);
  }).pipe(Effect.catchAll(failTo(ctx, key)));

export const createSession = (ctx: Ctx, name?: string) =>
  viaBackground(
    ctx,
    (m) =>
      m
        .toBackground({ _tag: 'SessionCreate', ...(name === undefined ? {} : { name }) })
        .pipe(Effect.flatMap((s) => m.toBackground({ _tag: 'SessionActivate', id: s.id }))),
    'session',
  ).pipe(Effect.zipRight(navigate(ctx, 'list')));

export const activateSession = (ctx: Ctx, id: SessionId) =>
  viaBackground(ctx, (m) => m.toBackground({ _tag: 'SessionActivate', id }), 'session').pipe(
    Effect.zipRight(navigate(ctx, 'list')),
  );

export const renameSession = (ctx: Ctx, id: SessionId, name: string) =>
  viaBackground(ctx, (m) => m.toBackground({ _tag: 'SessionRename', id, name }), 'session');

export const deleteSession = (ctx: Ctx, id: SessionId) =>
  viaBackground(ctx, (m) => m.toBackground({ _tag: 'SessionDelete', id }), 'session').pipe(
    Effect.zipRight(ui(ctx, { confirmDeleteSession: null })),
  );

export const updateSettings = (ctx: Ctx, patch: SettingsPatch) =>
  viaBackground(ctx, (m) => m.toBackground({ _tag: 'SettingsUpdate', patch }), 'settings');
