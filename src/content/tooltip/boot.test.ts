import { Effect, Logger, LogLevel, Option } from 'effect';
import { describe, expect, it, vi } from 'vitest';
import { defaultSettings, type Note, type SessionId } from '../../domain';
import { note, session } from '../../messaging/fixtures';
import { SessionStore, SessionStoreMemory } from '../../storage';
import { loadBoot, type BootDeps } from './boot';

const otherId = 'fv-zzzz' as SessionId;
const kv = Effect.runSync(
  Effect.gen(function* () {
    return yield* SessionStore;
  }).pipe(Effect.provide(SessionStoreMemory())),
);

const rig = (activeSessionId: SessionId | null, holder: SessionId | null) => {
  const get = vi.fn((sid: SessionId) =>
    Effect.succeed(sid === holder ? Option.some<Note>({ ...note, sessionId: sid }) : Option.none()),
  );
  const deps = {
    settings: { get: Effect.succeed({ ...defaultSettings, activeSessionId }) },
    sessions: {
      get: () => Effect.succeed(Option.none()),
      list: Effect.succeed({ items: [session, { ...session, id: otherId }], corrupt: 0 }),
    },
    notes: { get },
    sessionStore: kv,
  } as unknown as BootDeps;
  return { deps, get };
};

const opts = { mode: 'reopen', noteId: note.id } as never;
const load = (deps: BootDeps) => Effect.runPromise(loadBoot(deps, opts, 'https://x.test/', '#a'));

describe('loadBoot reopen', () => {
  it('finds the note in the active session without scanning others', async () => {
    const { deps, get } = rig(session.id, session.id);
    expect((await load(deps))?.note?.id).toBe(note.id);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('searches the other sessions after a session switch', async () => {
    const { deps } = rig(session.id, otherId);
    expect((await load(deps))?.note?.sessionId).toBe(otherId);
  });

  it('searches every session when no session is active', async () => {
    const { deps } = rig(null, otherId);
    expect((await load(deps))?.note?.id).toBe(note.id);
  });

  it('logs a warning and returns null when the note is nowhere', async () => {
    const { deps } = rig(session.id, null);
    const warnings: unknown[] = [];
    const collect = Logger.replace(
      Logger.defaultLogger,
      Logger.make(({ logLevel, message }) => {
        if (logLevel === LogLevel.Warning) warnings.push(message);
      }),
    );
    const boot = await Effect.runPromise(
      loadBoot(deps, opts, 'https://x.test/', '#a').pipe(Effect.provide(collect)),
    );
    expect(boot).toBeNull();
    expect(warnings.length).toBeGreaterThan(0);
  });
});
