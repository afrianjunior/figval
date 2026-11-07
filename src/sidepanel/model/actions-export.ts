import { Effect, Option } from 'effect';
import { exportFilename, render } from '../../markdown';
import { Clipboard, Download } from '../../platform';
import { ShotStore } from '../../storage';
import { ShotStoreError, type NoteId } from '../../domain';
import { clearError, failTo, flash, getState, nowMs, type Ctx, type PanelEnv } from './context';
import { exportNotes } from './selection';
import { activeSessionOf } from './state';
import { shellOf } from './view-model';

interface Rendered {
  readonly text: string;
  readonly filename: string;
}

/** None when the footer would be disabled: no session, nothing in scope, or nothing checked. */
const renderExport = (ctx: Ctx): Effect.Effect<Option.Option<Rendered>, never, PanelEnv> =>
  Effect.gen(function* () {
    const state = yield* getState(ctx);
    const session = activeSessionOf(state);
    if (session === null || shellOf(state).footer.exportDisabled) return Option.none();
    const notes = exportNotes(state);
    const now = yield* nowMs;
    const text = render(state.ui.format, { session, notes, now });
    return Option.some({ text, filename: exportFilename(notes, now) });
  });

export const exportCopy = (ctx: Ctx): Effect.Effect<void, never, PanelEnv> =>
  Effect.gen(function* () {
    const rendered = yield* renderExport(ctx);
    if (Option.isNone(rendered)) return;
    const clipboard = yield* Clipboard;
    yield* clipboard.writeText(rendered.value.text);
    yield* clearError(ctx, 'export');
    yield* flash(ctx, 'export-copy');
  }).pipe(Effect.catchAll(failTo(ctx, 'export')));

export const exportDownload = (ctx: Ctx): Effect.Effect<void, never, PanelEnv> =>
  Effect.gen(function* () {
    const rendered = yield* renderExport(ctx);
    if (Option.isNone(rendered)) return;
    const download = yield* Download;
    yield* download.markdown(rendered.value.filename, rendered.value.text);
    yield* clearError(ctx, 'export');
    yield* flash(ctx, 'export-download');
  });

export const copyShot = (ctx: Ctx, noteId: NoteId, which: 'before' | 'after'): Effect.Effect<void, never, PanelEnv> =>
  Effect.gen(function* () {
    const note = (yield* getState(ctx)).notes.find((n) => n.id === noteId);
    const shotId = note?.shots[which] ?? null;
    if (shotId === null) return yield* new ShotStoreError({ op: 'get', cause: 'no screenshot' });
    const blob = yield* (yield* ShotStore).get(shotId);
    if (Option.isNone(blob)) return yield* new ShotStoreError({ op: 'get', cause: 'missing blob' });
    yield* (yield* Clipboard).writeImage(blob.value);
    yield* clearError(ctx, 'copyShot');
    yield* flash(ctx, `shot:${noteId}:${which}`);
  }).pipe(Effect.catchAll(failTo(ctx, 'copyShot')));
