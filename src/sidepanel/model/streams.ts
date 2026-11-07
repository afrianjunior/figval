import { Effect, Option, Schedule, Schema, Stream, SubscriptionRef } from 'effect';
import { NoteId, normalizePageKey, TabId, type Note } from '../../domain';
import { Messenger } from '../../messaging';
import { Tabs, unsupportedUrl, type TabInfo } from '../../platform';
import { NoteRepo, SessionRepo, SessionStore, SettingsRepo } from '../../storage';
import { clearError, failTo, getState, update, type Ctx, type PanelEnv } from './context';
import { activeSessionOf, initialActivation, withUi, type ActiveTab, type ModelState } from './state';

export const activationKey = (tabId: number): string => `activation:${tabId}`;
export const missingKey = (tabId: number): string => `missing:${tabId}`;
export const HOVER_KEY = 'hover';

const Activation = Schema.Struct({ active: Schema.Boolean });
const Hover = Schema.Struct({ noteId: Schema.NullOr(NoteId) });
const MissingIds = Schema.Array(NoteId);

/** Session-storage values come from other contexts; anything undecodable reads as "absent". */
const decodeOr = <A, I>(schema: Schema.Schema<A, I>, fallback: A) => {
  const decode = Schema.decodeUnknownOption(schema);
  return (raw: unknown): A => Option.getOrElse(decode(raw), () => fallback);
};

const RESUBSCRIBE = Schedule.spaced('1 second');

/** A live stream must outlive a failed read: log, wait, subscribe again. */
const resubscribe = <A, E, R>(
  stream: Stream.Stream<A, E, R>,
  onError: (e: E) => Effect.Effect<void> = () => Effect.void,
): Stream.Stream<A, never, R> =>
  stream.pipe(
    Stream.tapError((e) => Effect.logWarning('figval panel: live stream failed, resubscribing', e).pipe(Effect.zipRight(onError(e)))),
    Stream.retry(RESUBSCRIBE),
    // divergent: RESUBSCRIBE never completes, so this failure channel is unreachable
    Stream.orDie,
  );

/** Latest value of one session-storage key: initial read, then re-read on each change. */
const sessionKey = (key: string): Stream.Stream<unknown, never, SessionStore> =>
  resubscribe(
    Stream.unwrap(
      Effect.map(SessionStore, (kv) =>
        Stream.merge(Stream.make(null), kv.changes.pipe(Stream.filter((c) => c.key === key))).pipe(
          Stream.mapEffect(() => kv.get(key)),
        ),
      ),
    ),
  );

const tabIdChanges = (ctx: Ctx): Stream.Stream<TabId | null> =>
  ctx.ref.changes.pipe(
    Stream.map((s) => s.activeTab?.id ?? null),
    Stream.changes,
  );

const perTab = <A>(ctx: Ctx, key: (id: number) => string, read: (raw: unknown) => A, none: A) =>
  tabIdChanges(ctx).pipe(
    Stream.flatMap((id) => (id === null ? Stream.make(none) : sessionKey(key(id)).pipe(Stream.map(read))), {
      switch: true,
    }),
  );

const toActiveTab = (tab: TabInfo): ActiveTab => ({ id: tab.id, url: tab.url, title: tab.title });

const sameTab = (a: ActiveTab, b: ActiveTab): boolean => a.id === b.id && a.url === b.url && a.title === b.title;

const tabStream = (ctx: Ctx): Stream.Stream<ActiveTab, never, Tabs> =>
  Stream.unwrap(
    Effect.map(Tabs, (tabs) => {
      const bound = ctx.boundTabId;
      if (bound === undefined) {
        return Stream.merge(
          Stream.fromEffect(tabs.queryActive).pipe(Stream.filterMap((o) => o)),
          tabs.activeChanges,
        );
      }
      // The bound tab is usually not the focused one (test mode): follow its own updates.
      // divergent: a closed or unreadable bound tab simply yields no tab update
      const read = tabs.get(bound).pipe(Effect.option, Effect.map(Option.getOrNull));
      return Stream.mergeAll(
        [
          Stream.fromEffect(read),
          tabs.onUpdated.pipe(
            Stream.filter((u) => u.tabId === bound && (u.status === 'complete' || u.url !== undefined)),
            Stream.mapEffect(() => read),
          ),
          tabs.activeChanges.pipe(Stream.filter((t) => t.id === bound)),
        ],
        { concurrency: 3 },
      ).pipe(Stream.filterMap((t) => Option.fromNullable(t)));
    }),
  ).pipe(
    Stream.map(toActiveTab),
    Stream.changesWith(sameTab),
  );

const onTab = (ctx: Ctx) => (tab: ActiveTab) =>
  update(ctx, (s) => {
    const sameOrigin = s.activeTab?.id === tab.id;
    return {
      ...s,
      activeTab: tab,
      activation: {
        ...(sameOrigin ? s.activation : initialActivation),
        unsupported: unsupportedUrl(tab.url),
        ...(sameOrigin && s.activeTab?.url === tab.url
          ? {}
          : { permissionDenied: false, injectionFailed: false }),
      },
    };
  });

const loop = <A, E>(stream: Stream.Stream<A, E, PanelEnv>, ctx: Ctx, onValue: (a: A) => Effect.Effect<void>) =>
  resubscribe(stream, failTo(ctx, 'storage')).pipe(
    Stream.runForEach(onValue),
    Effect.forkIn(ctx.scope),
  );

const settingsLoop = (ctx: Ctx) =>
  Effect.flatMap(SettingsRepo, (repo) =>
    loop(repo.stream, ctx, (settings) =>
      update(ctx, (s) => ({ ...s, settings, loaded: { ...s.loaded, settings: true } })),
    ),
  );

const sessionsLoop = (ctx: Ctx) =>
  Effect.flatMap(SessionRepo, (repo) =>
    loop(repo.stream, ctx, (sessions) =>
      update(ctx, (s) => ({ ...s, sessions, loaded: { ...s.loaded, sessions: true } })),
    ),
  );

interface NotesFeed {
  readonly sessionId: string | null;
  readonly notes: readonly Note[];
  readonly corrupt: number;
}

const notesFeed = (ctx: Ctx): Stream.Stream<NotesFeed, never, NoteRepo> =>
  ctx.ref.changes.pipe(
    Stream.map((s) => s.settings.activeSessionId),
    Stream.changes,
    Stream.flatMap(
      (id) =>
        id === null
          ? Stream.succeed<NotesFeed>({ sessionId: null, notes: [], corrupt: 0 })
          : Stream.unwrap(
              Effect.map(NoteRepo, (repo) =>
                repo.stream(id).pipe(
                  Stream.mapEffect((notes) =>
                    repo.list(id).pipe(
                      Effect.map((l) => l.corrupt),
                      // divergent: a failed corrupt-count read must not drop the notes that did load
                      Effect.orElseSucceed(() => 0),
                      Effect.map((corrupt): NotesFeed => ({ sessionId: id, notes, corrupt })),
                    ),
                  ),
                  (feed) => resubscribe(feed, failTo(ctx, 'storage')),
                ),
              ),
            ),
      { switch: true },
    ),
  );

const notesLoop = (ctx: Ctx) =>
  loop(notesFeed(ctx), ctx, (feed) =>
    update(ctx, (s) => {
      const sessionChanged = (activeSessionOf(s)?.id ?? null) !== feed.sessionId && s.notes.length > 0;
      const base = { ...s, notes: feed.notes, corruptCount: feed.corrupt };
      return sessionChanged ? withUi(base, { localOrder: null, selectedIds: new Set() }) : base;
    }),
  );

const countsKey = (s: ModelState): string => s.sessions.map((x) => `${x.id}:${x.updatedAt}`).join('|');

const pageCounts = (notes: readonly Note[]): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const n of notes) {
    const key = normalizePageKey(n.page.url);
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
};

/** Per-session page counts: one cheap NoteRepo.list per session whenever the session list changes. */
const countsLoop = (ctx: Ctx) =>
  Effect.flatMap(NoteRepo, (repo) =>
    loop(
      ctx.ref.changes.pipe(
        Stream.map(countsKey),
        Stream.changes,
        Stream.mapEffect(() => getState(ctx)),
        Stream.mapEffect((s) =>
          Effect.forEach(s.sessions, (x) =>
            repo.list(x.id).pipe(
              Effect.map((l) => [x.id, pageCounts(l.items)] as const),
              // divergent: one unreadable session shows no page counts instead of blocking the rest
              Effect.orElseSucceed(() => [x.id, {}] as const),
            ),
          ),
        ),
      ),
      ctx,
      (entries) => update(ctx, (s) => ({ ...s, sessionPageCounts: Object.fromEntries(entries) })),
    ),
  );

const activeTabLoop = (ctx: Ctx) =>
  Effect.flatMap(Tabs, () => loop(tabStream(ctx), ctx, onTab(ctx)));

const activationLoop = (ctx: Ctx) =>
  loop(perTab(ctx, activationKey, decodeOr(Activation, { active: false }), { active: false }), ctx, ({ active }) =>
    update(ctx, (s) => ({ ...s, activation: { ...s.activation, active } })),
  );

const missingLoop = (ctx: Ctx) =>
  loop(perTab(ctx, missingKey, decodeOr(MissingIds, []), []), ctx, (ids) =>
    update(ctx, (s) => ({ ...s, missingIds: ids })),
  );

const hoverLoop = (ctx: Ctx) =>
  loop(sessionKey(HOVER_KEY).pipe(Stream.map(decodeOr(Hover, { noteId: null }))), ctx, ({ noteId }) =>
    update(ctx, (s) => ({ ...s, hoverNoteId: noteId })),
  );

interface MarkerKey {
  readonly tab: ActiveTab | null;
  readonly active: boolean;
  readonly notes: readonly Note[];
  readonly hidden: string | null;
}

const markerKey = (s: ModelState): MarkerKey => ({
  tab: s.activeTab,
  active: s.activation.active,
  notes: s.notes,
  hidden: s.ui.pendingDelete?.id ?? null,
});

const sameMarkerKey = (a: MarkerKey, b: MarkerKey): boolean =>
  a.tab?.id === b.tab?.id &&
  a.tab?.url === b.tab?.url &&
  a.active === b.active &&
  a.notes === b.notes &&
  a.hidden === b.hidden;

const renderMarkers = (ctx: Ctx, key: MarkerKey): Effect.Effect<void, never, Messenger> => {
  const { tab, active, notes, hidden } = key;
  if (tab === null || !active) return Effect.void;
  const pageKey = normalizePageKey(tab.url);
  const onPage = notes.filter((n) => n.id !== hidden && normalizePageKey(n.page.url) === pageKey);
  return Effect.gen(function* () {
    const messenger = yield* Messenger;
    yield* messenger.toContent(tab.id, { _tag: 'MarkersRender', notes: onPage });
    yield* clearError(ctx, 'markers');
  }).pipe(Effect.catchAll(failTo(ctx, 'markers')));
};

/** Whenever tab, notes or activation change and Figval is active there, redraw that page's markers. */
const markersLoop = (ctx: Ctx) =>
  ctx.ref.changes.pipe(
    Stream.map(markerKey),
    Stream.changesWith(sameMarkerKey),
    Stream.flatMap((key) => Stream.fromEffect(renderMarkers(ctx, key)), { switch: true }),
    Stream.runDrain,
    Effect.forkIn(ctx.scope),
  );

/** Forks every long-lived stream into the store scope. */
export const startStreams = (ctx: Ctx): Effect.Effect<void, never, PanelEnv> =>
  Effect.all(
    [
      settingsLoop(ctx),
      sessionsLoop(ctx),
      notesLoop(ctx),
      countsLoop(ctx),
      activeTabLoop(ctx),
      activationLoop(ctx),
      missingLoop(ctx),
      hoverLoop(ctx),
      markersLoop(ctx),
    ],
    { discard: true },
  );

export const makeRef = (initial: ModelState) => SubscriptionRef.make(initial);
