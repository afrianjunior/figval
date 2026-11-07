import { Effect, Option } from 'effect';
import {
  defaultSettings,
  type Note,
  type NoteId,
  type SessionId,
  type Settings,
} from '../../domain';
import type {
  NoteRepoService,
  SessionRepoService,
  SettingsRepoService,
  SessionKvService,
} from '../../storage';
import type { TooltipOpenOptions } from '../picker';
import { readDraft } from './drafts';
import { draftKey, type StoredDraft } from './model/draft';

export interface Boot {
  readonly settings: Settings;
  readonly seq: number;
  /** Set in reopen mode. */
  readonly note: Note | null;
  readonly resume: StoredDraft | null;
}

export interface BootDeps {
  readonly settings: SettingsRepoService;
  readonly sessions: SessionRepoService;
  readonly notes: NoteRepoService;
  readonly sessionStore: SessionKvService;
}

const orNone = <A, E>(
  effect: Effect.Effect<Option.Option<A>, E>,
): Effect.Effect<Option.Option<A>> =>
  effect.pipe(
    // divergent: boot reads degrade to "nothing stored" so the tooltip still opens.
    Effect.orElseSucceed(() => Option.none<A>()),
  );

/** The active session first, then every other session, so a reopen survives a session switch. */
const findNote = (
  deps: BootDeps,
  activeId: SessionId | null,
  noteId: NoteId,
): Effect.Effect<Option.Option<Note>> =>
  Effect.gen(function* () {
    if (activeId) {
      const hit = yield* orNone(deps.notes.get(activeId, noteId));
      if (Option.isSome(hit)) return hit;
    }
    // divergent: an unreadable session list is treated as "no other sessions".
    const { items } = yield* deps.sessions.list.pipe(
      Effect.orElseSucceed(() => ({ items: [], corrupt: 0 })),
    );
    for (const s of items) {
      if (s.id === activeId) continue;
      const hit = yield* orNone(deps.notes.get(s.id, noteId));
      if (Option.isSome(hit)) return hit;
    }
    return Option.none<Note>();
  });

/** Reads settings, the next seq (or the note being reopened) and any stored draft. Storage errors degrade to defaults. */
export const loadBoot = (
  deps: BootDeps,
  opts: TooltipOpenOptions,
  url: string,
  selector: string,
): Effect.Effect<Boot | null> =>
  Effect.gen(function* () {
    // divergent: unreadable settings fall back to defaults so the tooltip still opens.
    const settings = yield* deps.settings.get.pipe(Effect.orElseSucceed(() => defaultSettings));
    const sessionId = settings.activeSessionId;
    const session = sessionId ? yield* orNone(deps.sessions.get(sessionId)) : Option.none();
    if (opts.mode === 'reopen') {
      const found = opts.noteId
        ? yield* findNote(deps, sessionId, opts.noteId)
        : Option.none<Note>();
      if (Option.isNone(found))
        yield* Effect.logWarning('figval: note to reopen not found', opts.noteId);
      return Option.match(found, {
        onNone: () => null,
        onSome: (note): Boot => ({ settings, seq: note.seq, note, resume: null }),
      });
    }
    const stored = yield* readDraft(deps.sessionStore, draftKey(url));
    return {
      settings,
      seq: Option.match(session, { onNone: () => 1, onSome: (s) => s.nextSeq }),
      note: null,
      resume: Option.getOrNull(Option.filter(stored, (d) => d.selector === selector)),
    };
  });
