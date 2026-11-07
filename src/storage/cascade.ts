import { Effect } from 'effect';
import type { Note, SessionId, ShotId, ShotStoreError } from '../domain';
import { NoteRepo } from './note-repo';
import { SessionRepo } from './session-repo';
import { ShotStore } from './shot-store';
import type { RepoError } from './types';

const shotIdsOf = (notes: readonly Note[]): readonly ShotId[] =>
  notes.flatMap((n) => [n.shots.before, n.shots.after]).filter((id): id is ShotId => id !== null);

/** Session -> notes -> shots. Notes are listed first so shot ids are known before the notes key goes. */
export const cascadeDeleteSession = (
  sessionId: SessionId,
): Effect.Effect<void, RepoError | ShotStoreError, SessionRepo | NoteRepo | ShotStore> =>
  Effect.gen(function* () {
    const notes = yield* NoteRepo;
    const sessions = yield* SessionRepo;
    const shots = yield* ShotStore;
    const { items } = yield* notes.list(sessionId);
    yield* notes.removeAll(sessionId);
    yield* sessions.remove(sessionId);
    yield* shots.removeMany(shotIdsOf(items));
  });
