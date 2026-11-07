import { Effect } from 'effect';
import type { Intent, NoteId, NotePatch, NoteTag, SessionId } from '../../domain';
import type { SettingsPatch } from '../../messaging';
import * as exportActions from './actions-export';
import * as notes from './actions-notes';
import * as page from './actions-page';
import * as ui from './actions-ui';
import type { Ctx, PanelEnv } from './context';
import type { BeforeAfter, ErrorKey, ExportFormatChoice, ExportScope, PanelView } from './state';

type Act<A extends unknown[] = []> = (...args: A) => Effect.Effect<void, never, PanelEnv>;

export interface EffectActions {
  readonly pick: Act;
  readonly showNotes: Act;
  readonly updateNote: Act<[id: NoteId, patch: NotePatch]>;
  readonly flushNote: Act<[id: NoteId]>;
  readonly deleteNote: Act<[id: NoteId]>;
  readonly undoDelete: Act;
  readonly reorder: Act<[ids: readonly NoteId[]]>;
  readonly createSession: Act<[name?: string]>;
  readonly activateSession: Act<[id: SessionId]>;
  readonly renameSession: Act<[id: SessionId, name: string]>;
  readonly deleteSession: Act<[id: SessionId]>;
  readonly requestDeleteSession: Act<[id: SessionId]>;
  readonly cancelDeleteSession: Act;
  readonly updateSettings: Act<[patch: SettingsPatch]>;
  readonly navigate: Act<[view: PanelView]>;
  readonly back: Act;
  readonly setSearch: Act<[query: string]>;
  readonly toggleType: Act<[tag: NoteTag]>;
  readonly toggleIntent: Act<[intent: Intent]>;
  readonly toggleNotFound: Act;
  readonly resetFilters: Act;
  readonly setFormat: Act<[format: ExportFormatChoice]>;
  readonly setScope: Act<[scope: ExportScope]>;
  readonly toggleSelected: Act<[id: NoteId]>;
  readonly clearSelection: Act;
  readonly hover: Act<[noteId: NoteId | null]>;
  readonly open: Act<[noteId: NoteId]>;
  readonly editOnPage: Act<[noteId: NoteId]>;
  readonly setBeforeAfter: Act<[value: BeforeAfter]>;
  readonly exportCopy: Act;
  readonly exportDownload: Act;
  readonly copyShot: Act<[noteId: NoteId, which: 'before' | 'after']>;
  readonly dismissError: Act<[key: ErrorKey]>;
}

/** Promise facade handed to the UI: every action runs on the store's runtime. */
export type PanelActions = {
  readonly [K in keyof EffectActions]: (...args: Parameters<EffectActions[K]>) => Promise<void>;
};

export const makeEffectActions = (ctx: Ctx): EffectActions => ({
  pick: () => page.pick(ctx),
  showNotes: () => page.showNotes(ctx),
  updateNote: (id, patch) => notes.updateNote(ctx, id, patch),
  flushNote: (id) => notes.flushNote(ctx, id),
  deleteNote: (id) => notes.deleteNote(ctx, id),
  undoDelete: () => notes.undoDelete(ctx),
  reorder: (ids) => notes.reorder(ctx, ids),
  createSession: (name) => ui.createSession(ctx, name),
  activateSession: (id) => ui.activateSession(ctx, id),
  renameSession: (id, name) => ui.renameSession(ctx, id, name),
  deleteSession: (id) => ui.deleteSession(ctx, id),
  requestDeleteSession: (id) => ui.requestDeleteSession(ctx, id),
  cancelDeleteSession: () => ui.cancelDeleteSession(ctx),
  updateSettings: (patch) => ui.updateSettings(ctx, patch),
  navigate: (view) => ui.navigate(ctx, view),
  // pending autosaves go out before the detail screen closes
  back: () => notes.flushAllNotes(ctx).pipe(Effect.zipRight(ui.back(ctx))),
  setSearch: (q) => ui.setSearch(ctx, q),
  toggleType: (t) => ui.toggleType(ctx, t),
  toggleIntent: (i) => ui.toggleIntent(ctx, i),
  toggleNotFound: () => ui.toggleNotFound(ctx),
  resetFilters: () => ui.resetFilters(ctx),
  setFormat: (f) => ui.setFormat(ctx, f),
  setScope: (s) => ui.setScope(ctx, s),
  toggleSelected: (id) => ui.toggleSelected(ctx, id),
  clearSelection: () => ui.clearSelection(ctx),
  hover: (id) => page.hover(ctx, id),
  open: (id) => page.open(ctx, id),
  editOnPage: (id) => page.editOnPage(ctx, id),
  setBeforeAfter: (v) => page.setBeforeAfter(ctx, v),
  exportCopy: () => exportActions.exportCopy(ctx),
  exportDownload: () => exportActions.exportDownload(ctx),
  copyShot: (id, which) => exportActions.copyShot(ctx, id, which),
  dismissError: (key) => ui.dismissError(ctx, key),
});
