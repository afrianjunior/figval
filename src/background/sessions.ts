import { Effect, Option } from 'effect';
import { defaultSessionName } from '../copy';
import {
  NoteSaveError,
  normalizePage,
  type Session,
  type SessionId,
  type Settings,
} from '../domain';
import type { SettingsPatch } from '../messaging';
import { Clock, Ids, Tabs } from '../platform';
import { cascadeDeleteSession, SessionRepo, SettingsRepo } from '../storage';

const sessionNotFound = () => new NoteSaveError({ reason: 'SessionNotFound' });

const requireSession = (id: SessionId) =>
  Effect.flatMap(SessionRepo, (repo) => repo.get(id)).pipe(
    Effect.flatMap(
      Option.match({ onNone: () => Effect.fail(sessionNotFound()), onSome: Effect.succeed }),
    ),
  );

const setActive = (activeSessionId: SessionId | null) =>
  Effect.gen(function* () {
    const settings = yield* SettingsRepo;
    const next: Settings = { ...(yield* settings.get), activeSessionId };
    yield* settings.put(next);
    return next;
  });

const activeHost = Effect.flatMap(Tabs, (tabs) => tabs.queryActive).pipe(
  Effect.map(Option.match({ onNone: () => '', onSome: (tab) => normalizePage(tab.url).host })),
);

/** New session; it becomes the active one. */
export const createSession = (name?: string) =>
  Effect.gen(function* () {
    const now = yield* (yield* Clock).now;
    const id = yield* (yield* Ids).sessionId;
    const session: Session = {
      schemaVersion: 1,
      id,
      name: name ?? defaultSessionName(yield* activeHost, now),
      createdAt: now,
      updatedAt: now,
      nextSeq: 1 as Session['nextSeq'],
      noteOrder: [],
    };
    yield* (yield* SessionRepo).insert(session);
    yield* setActive(id);
    return session;
  });

export const renameSession = (id: SessionId, name: string) =>
  Effect.gen(function* () {
    const session = yield* requireSession(id);
    const now = yield* (yield* Clock).now;
    const renamed: Session = { ...session, name, updatedAt: now };
    yield* (yield* SessionRepo).replace(renamed);
    return renamed;
  });

/** Cascade (notes + shots); when it was active, the most recently updated remaining session takes over. */
export const deleteSession = (id: SessionId) =>
  Effect.gen(function* () {
    const settings = yield* (yield* SettingsRepo).get;
    yield* cascadeDeleteSession(id);
    if (settings.activeSessionId !== id) return;
    const { items } = yield* (yield* SessionRepo).list;
    const latest = [...items].sort((a, b) => b.updatedAt - a.updatedAt)[0];
    yield* setActive(latest?.id ?? null);
  });

export const activateSession = (id: SessionId) =>
  requireSession(id).pipe(Effect.zipRight(setActive(id)));

export const updateSettings = (patch: SettingsPatch) =>
  Effect.gen(function* () {
    const repo = yield* SettingsRepo;
    const next: Settings = { ...(yield* repo.get), ...patch };
    yield* repo.put(next);
    return next;
  });
