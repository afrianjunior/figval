import { Effect, Option } from 'effect';
import { describe, expect, it } from 'vitest';
import { cascadeDeleteSession } from './cascade';
import { makeNote, makeSession, shotId, sid } from './fixtures';
import { StorageMemory } from './layers';
import { NoteRepo } from './note-repo';
import { SessionRepo } from './session-repo';
import { ShotStore } from './shot-store';

describe('cascadeDeleteSession', () => {
  it('removes the session, its notes and its shots, leaving other sessions alone', async () => {
    const out = await Effect.runPromise(
      Effect.gen(function* () {
        const sessions = yield* SessionRepo;
        const notes = yield* NoteRepo;
        const shots = yield* ShotStore;
        yield* sessions.insert(makeSession('fv-aaaa'));
        yield* sessions.insert(makeSession('fv-bbbb'));
        yield* notes.insert(
          makeNote(1, 'fv-aaaa', { shots: { before: shotId(1), after: shotId(2) } }),
        );
        yield* notes.insert(makeNote(2, 'fv-aaaa', { shots: { before: null, after: shotId(3) } }));
        yield* notes.insert(makeNote(1, 'fv-bbbb', { shots: { before: shotId(4), after: null } }));
        for (const n of [1, 2, 3, 4]) yield* shots.put(shotId(n), new Blob([String(n)]));

        yield* cascadeDeleteSession(sid('fv-aaaa'));

        return {
          sessions: (yield* sessions.list).items.map((s) => s.id),
          notesA: (yield* notes.list(sid('fv-aaaa'))).items.length,
          notesB: (yield* notes.list(sid('fv-bbbb'))).items.length,
          shots: yield* Effect.forEach([1, 2, 3, 4], (n) => shots.get(shotId(n))),
        };
      }).pipe(Effect.provide(StorageMemory)),
    );
    expect(out.sessions).toEqual(['fv-bbbb']);
    expect(out.notesA).toBe(0);
    expect(out.notesB).toBe(1);
    expect(out.shots.map(Option.isSome)).toEqual([false, false, false, true]);
  });

  it('is a no-op for an unknown session', async () => {
    await Effect.runPromise(
      cascadeDeleteSession(sid('fv-zzzz')).pipe(Effect.provide(StorageMemory)),
    );
  });
});
