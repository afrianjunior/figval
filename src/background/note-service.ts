import { Effect, Option } from 'effect';
import { defaultSessionName } from '../copy';
import {
  hasEdits,
  NoteSaveError,
  normalizePage,
  normalizePageKey,
  type Note,
  type NoteDraft,
  type NoteId,
  type NotePatch,
  type Session,
  type Settings,
  type ShotId,
  type TabId,
} from '../domain';
import { Clock, Ids, Tabs, type Rect, type TabInfo } from '../platform';
import { NoteRepo, SessionRepo, SettingsRepo, ShotStore } from '../storage';
import { captureCurrent, captureShots, cropRect, noShots, type CaptureTarget } from './capture';

/** Wraps an effect in the runtime-wide write permit. */
export type Lock = <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>;
export const identityLock: Lock = (effect) => effect;

const saveError = (e: { readonly _tag: string }): NoteSaveError =>
  e instanceof NoteSaveError ? e : new NoteSaveError({ reason: e._tag });

/** The tab to capture: the one named by the message, else the active tab. None means no capture. */
const resolveTab = (tabId: TabId | undefined) =>
  Effect.flatMap(Tabs, (tabs) =>
    tabId === undefined ? tabs.queryActive : tabs.get(tabId).pipe(Effect.option),
  );

/** No rect (re-capture on update) keeps the whole viewport. */
const captureTarget = (tab: TabInfo, page: NoteDraft['page'], rect?: Rect): CaptureTarget => ({
  tabId: tab.id,
  windowId: tab.windowId,
  rect: cropRect(rect, page.viewport),
  dpr: page.dpr,
});

const shotsFor = (draft: NoteDraft, tabId: TabId | undefined, settings: Settings, rect?: Rect) =>
  settings.screenshots
    ? resolveTab(tabId).pipe(
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.succeed(noShots),
            onSome: (tab) => captureShots(captureTarget(tab, draft.page, rect), hasEdits(draft)),
          }),
        ),
      )
    : Effect.succeed(noShots);

/** Best-effort undo; the original failure stays the reported one. */
export const rollback = <R>(what: string, undo: Effect.Effect<void, unknown, R>) =>
  undo.pipe(
    // divergent: a failed undo must not mask the original error; log it instead
    Effect.catchAll((e) => Effect.logWarning(`rollback of ${what} failed`, e)),
  );

const startSession = (settings: Settings, draft: NoteDraft) =>
  Effect.gen(function* () {
    const id = yield* (yield* Ids).sessionId;
    const now = yield* (yield* Clock).now;
    const session: Session = {
      schemaVersion: 1,
      id,
      name: defaultSessionName(normalizePage(draft.page.url).host, now),
      createdAt: now,
      updatedAt: now,
      nextSeq: 1 as Session['nextSeq'],
      noteOrder: [],
    };
    const sessions = yield* SessionRepo;
    yield* sessions.insert(session);
    yield* (yield* SettingsRepo).put({ ...settings, activeSessionId: id }).pipe(
      // compensate: no orphan session when the settings write fails
      Effect.tapError(() => rollback('session', sessions.remove(id))),
    );
    return session;
  });

/** Active session, created on the first note. */
const ensureActive = (settings: Settings, draft: NoteDraft) =>
  Effect.gen(function* () {
    const sessions = yield* SessionRepo;
    if (settings.activeSessionId !== null) {
      const found = yield* sessions.get(settings.activeSessionId);
      if (Option.isSome(found)) return found.value;
    }
    return yield* startSession(settings, draft);
  });

const shotIdsOf = (shots: Note['shots']): readonly ShotId[] =>
  [shots.before, shots.after].filter((id): id is ShotId => id !== null);

const insertNote = (draft: NoteDraft, session: Session, shots: Note['shots']) =>
  Effect.gen(function* () {
    const now = yield* (yield* Clock).now;
    const id = yield* (yield* Ids).noteId;
    const note: Note = {
      schemaVersion: 1,
      id,
      seq: session.nextSeq,
      sessionId: session.id,
      createdAt: now,
      updatedAt: now,
      ...draft,
      shots,
    };
    const notes = yield* NoteRepo;
    yield* notes.insert(note);
    yield* (yield* SessionRepo)
      .replace({
        ...session,
        nextSeq: (session.nextSeq + 1) as Session['nextSeq'],
        noteOrder: [...session.noteOrder, id],
        updatedAt: now,
      })
      .pipe(
        // compensate: no orphan note when the session write fails
        Effect.tapError(() => rollback('note', notes.remove(session.id, id))),
      );
    return note;
  });

const removeShots = (shots: Note['shots']) =>
  Effect.flatMap(ShotStore, (store) => rollback('shots', store.removeMany(shotIdsOf(shots))));

/**
 * F2: settings → shots (slow, outside the permit) → [permit: settings → ensure session →
 * NoteRepo.insert(seq) → SessionRepo.replace].
 */
export const createNote = (
  draft: NoteDraft,
  tabId?: TabId,
  rect?: Rect,
  lock: Lock = identityLock,
) =>
  Effect.gen(function* () {
    const settings = yield* (yield* SettingsRepo).get;
    const shots = yield* shotsFor(draft, tabId, settings, rect);
    const save = Effect.gen(function* () {
      const current = yield* (yield* SettingsRepo).get;
      const session = yield* ensureActive(current, draft);
      return yield* insertNote(draft, session, shots);
    });
    return yield* lock(save).pipe(Effect.tapError(() => removeShots(shots)));
  }).pipe(Effect.mapError(saveError));

/** Finds a note and its session; the active session is not assumed. */
const findNote = (id: NoteId) =>
  Effect.gen(function* () {
    const sessions = yield* SessionRepo;
    const notes = yield* NoteRepo;
    const { items } = yield* sessions.list;
    for (const session of items) {
      const found = yield* notes.get(session.id, id);
      if (Option.isSome(found)) return { session, note: found.value };
    }
    return yield* Effect.fail(new NoteSaveError({ reason: 'NoteNotFound' }));
  });

const applyPatch = (note: Note, patch: NotePatch, now: number): Note => ({
  ...note,
  comment: patch.comment ?? note.comment,
  why: patch.why ?? note.why,
  forceApply: patch.forceApply ?? note.forceApply,
  edits: patch.edits ?? note.edits,
  target: patch.label === undefined ? note.target : { ...note.target, label: patch.label },
  updatedAt: now,
});

const editsChanged = (before: Note, after: Note): boolean =>
  JSON.stringify(before.edits) !== JSON.stringify(after.edits);

/** The page is open in the active tab: only then does a fresh shot show the edited page. */
const activeTabOnPage = (note: Note) =>
  Effect.flatMap(Tabs, (tabs) => tabs.queryActive).pipe(
    Effect.map(
      Option.filter((tab) => normalizePageKey(tab.url) === normalizePageKey(note.page.url)),
    ),
  );

const putAfter = (existing: ShotId | null, blob: Blob) =>
  Effect.gen(function* () {
    const store = yield* ShotStore;
    if (existing !== null) {
      yield* store.replace(existing, blob);
      return existing;
    }
    const id = yield* (yield* Ids).shotId;
    yield* store.put(id, blob);
    return id;
  });

const dropAfter = (note: Note) =>
  Effect.gen(function* () {
    if (note.shots.after !== null) yield* (yield* ShotStore).remove(note.shots.after);
    return { ...note.shots, after: null } satisfies Note['shots'];
  });

const recaptureAfter = (note: Note, edited: Note) =>
  Effect.gen(function* () {
    if (!hasEdits(edited)) return yield* dropAfter(note);
    const tab = yield* activeTabOnPage(edited);
    if (Option.isNone(tab)) return note.shots;
    const blob = yield* captureCurrent(captureTarget(tab.value, edited.page));
    return { ...note.shots, after: yield* putAfter(note.shots.after, blob) };
  }).pipe(
    // divergent: re-capture is best effort; on any failure keep the old shots
    Effect.catchAll(() => Effect.succeed(note.shots)),
  );

/** F3: apply patch; re-capture `after` only when edits changed; NoteRepo.replace. */
export const updateNote = (id: NoteId, patch: NotePatch) =>
  Effect.gen(function* () {
    const { session, note } = yield* findNote(id);
    const now = yield* (yield* Clock).now;
    const patched = applyPatch(note, patch, now);
    const shots = editsChanged(note, patched) ? yield* recaptureAfter(note, patched) : note.shots;
    const saved: Note = { ...patched, shots };
    yield* (yield* NoteRepo).replace(saved);
    yield* (yield* SessionRepo).replace({ ...session, updatedAt: now });
    return saved;
  }).pipe(Effect.mapError(saveError));

/** F3: NoteRepo.remove → ShotStore.remove → session.noteOrder without id. */
export const deleteNote = (id: NoteId) =>
  Effect.gen(function* () {
    const { session, note } = yield* findNote(id);
    const now = yield* (yield* Clock).now;
    yield* (yield* NoteRepo).remove(session.id, id);
    yield* (yield* ShotStore).removeMany(shotIdsOf(note.shots));
    yield* (yield* SessionRepo).replace({
      ...session,
      noteOrder: session.noteOrder.filter((n) => n !== id),
      updatedAt: now,
    });
  }).pipe(Effect.mapError(saveError));
