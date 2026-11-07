import { Context, Effect, Layer, Option, Stream } from 'effect';
import { Note, type NoteId, type SessionId } from '../domain';
import { makeCollection, type Collection } from './collection';
import { notesKey } from './keys';
import { ChromeStorage } from './services';
import type { KvService, Listing, RepoError, RepoReadError } from './types';

export interface NoteRepoService {
  readonly list: (sessionId: SessionId) => Effect.Effect<Listing<Note>, RepoReadError>;
  readonly get: (
    sessionId: SessionId,
    noteId: NoteId,
  ) => Effect.Effect<Option.Option<Note>, RepoReadError>;
  /** Dies with InvariantViolation on a duplicate note id or seq within the session. */
  readonly insert: (note: Note) => Effect.Effect<void, RepoError>;
  /** Dies with InvariantViolation when the note id is unknown. */
  readonly replace: (note: Note) => Effect.Effect<void, RepoError>;
  readonly remove: (sessionId: SessionId, noteId: NoteId) => Effect.Effect<void, RepoError>;
  readonly removeAll: (sessionId: SessionId) => Effect.Effect<void, RepoReadError>;
  readonly stream: (sessionId: SessionId) => Stream.Stream<readonly Note[], RepoReadError>;
}

export class NoteRepo extends Context.Tag('figval/NoteRepo')<NoteRepo, NoteRepoService>() {}

const notesOf = (kv: KvService, sessionId: SessionId): Collection<Note> =>
  makeCollection(kv, notesKey(sessionId), {
    schema: Note,
    conflict: (existing, next) => {
      if (existing.id === next.id) return `duplicate note id ${next.id}`;
      return existing.seq === next.seq
        ? `duplicate note seq ${next.seq} in ${next.sessionId}`
        : null;
    },
  });

export const NoteRepoLive = Layer.effect(
  NoteRepo,
  Effect.map(ChromeStorage, (kv): NoteRepoService => ({
    list: (sessionId) => notesOf(kv, sessionId).list,
    get: (sessionId, noteId) => notesOf(kv, sessionId).get(noteId),
    insert: (note) => notesOf(kv, note.sessionId).insert(note),
    replace: (note) => notesOf(kv, note.sessionId).replace(note),
    remove: (sessionId, noteId) => notesOf(kv, sessionId).remove(noteId),
    removeAll: (sessionId) => notesOf(kv, sessionId).removeAll,
    stream: (sessionId) => notesOf(kv, sessionId).stream,
  })),
);
