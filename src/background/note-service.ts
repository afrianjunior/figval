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

/** The sender tab (else the active tab), only when it shows the note's page: a fresh shot then shows the edited page. */
const tabOnPage = (note: Note, tabId: TabId | undefined) =>
  resolveTab(tabId).pipe(
    Effect.map(
      Option.filter((tab) => normalizePageKey(tab.url) === normalizePageKey(note.page.url)),
    ),
  );

/** What the update does to `shots.after`; decided outside the permit, applied inside it. */
type AfterPlan =
  | { readonly kind: 'keep' }
  | { readonly kind: 'drop' }
  | { readonly kind: 'replace'; readonly id: ShotId; readonly created: boolean };

const keep: AfterPlan = { kind: 'keep' };

const putAfter = (existing: ShotId | null, blob: Blob) =>
  Effect.gen(function* () {
    const store = yield* ShotStore;
    if (existing !== null) {
      yield* store.replace(existing, blob);
      return { kind: 'replace', id: existing, created: false } satisfies AfterPlan;
    }
    const id = yield* (yield* Ids).shotId;
    yield* store.put(id, blob);
    return { kind: 'replace', id, created: true } satisfies AfterPlan;
  });

const planAfter = (note: Note, edited: Note, tabId: TabId | undefined) =>
  Effect.gen(function* () {
    if (!hasEdits(edited))
      return note.shots.after === null ? keep : ({ kind: 'drop' } as AfterPlan);
    const tab = yield* tabOnPage(edited, tabId);
    if (Option.isNone(tab)) return keep;
    const blob = yield* captureCurrent(captureTarget(tab.value, edited.page));
    return yield* putAfter(note.shots.after, blob);
  }).pipe(
    // divergent: re-capture is best effort; on any failure keep the old shots
    Effect.catchAll(() => Effect.succeed(keep)),
  );

const applyPlan = (shots: Note['shots'], plan: AfterPlan): Note['shots'] =>
  plan.kind === 'keep' ? shots : { ...shots, after: plan.kind === 'drop' ? null : plan.id };

const discardCreated = (plan: AfterPlan) =>
  plan.kind === 'replace' && plan.created
    ? Effect.flatMap(ShotStore, (store) => rollback('after shot', store.remove(plan.id)))
    : Effect.void;

const dropOldAfter = (before: Note, plan: AfterPlan) =>
  plan.kind === 'drop' && before.shots.after !== null
    ? Effect.flatMap(ShotStore, (store) =>
        rollback('after shot', store.remove(before.shots.after!)),
      )
    : Effect.void;

/**
 * F3: [capture outside the permit when edits changed] → [permit: findNote → NoteRepo.replace →
 * SessionRepo.replace]. A note that changed meanwhile keeps its stored shots; the new shot is discarded.
 */
export const updateNote = (
  id: NoteId,
  patch: NotePatch,
  tabId?: TabId,
  lock: Lock = identityLock,
) =>
  Effect.gen(function* () {
    const { note: seen } = yield* findNote(id);
    const now = yield* (yield* Clock).now;
    const plan = editsChanged(seen, applyPatch(seen, patch, now))
      ? yield* planAfter(seen, applyPatch(seen, patch, now), tabId)
      : keep;
    const save = Effect.gen(function* () {
      const { session, note } = yield* findNote(id);
      const stale = note.updatedAt !== seen.updatedAt;
      const saved: Note = {
        ...applyPatch(note, patch, now),
        shots: stale ? note.shots : applyPlan(note.shots, plan),
      };
      yield* (yield* NoteRepo).replace(saved);
      yield* (yield* SessionRepo).replace({ ...session, updatedAt: now });
      yield* stale ? discardCreated(plan) : dropOldAfter(note, plan);
      return saved;
    });
    return yield* lock(save).pipe(Effect.tapError(() => discardCreated(plan)));
  }).pipe(Effect.mapError(saveError));

/** F3: SessionRepo.replace (id out of noteOrder) → NoteRepo.remove → shots best effort. */
export const deleteNote = (id: NoteId) =>
  Effect.gen(function* () {
    const { session, note } = yield* findNote(id);
    const now = yield* (yield* Clock).now;
    yield* (yield* SessionRepo).replace({
      ...session,
      noteOrder: session.noteOrder.filter((n) => n !== id),
      updatedAt: now,
    });
    yield* (yield* NoteRepo).remove(session.id, id);
    yield* removeShots(note.shots);
  }).pipe(Effect.mapError(saveError));
