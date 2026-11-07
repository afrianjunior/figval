import { Context, Effect, Layer, Option, Stream } from 'effect';
import { Session, type SessionId } from '../domain';
import { makeCollection } from './collection';
import { SESSIONS_KEY } from './keys';
import { ChromeStorage } from './services';
import type { Listing, RepoError, RepoReadError } from './types';

export interface SessionRepoService {
  readonly list: Effect.Effect<Listing<Session>, RepoReadError>;
  readonly get: (id: SessionId) => Effect.Effect<Option.Option<Session>, RepoReadError>;
  /** Dies with InvariantViolation on a duplicate id. */
  readonly insert: (session: Session) => Effect.Effect<void, RepoError>;
  /** Dies with InvariantViolation when the id is unknown. */
  readonly replace: (session: Session) => Effect.Effect<void, RepoError>;
  readonly remove: (id: SessionId) => Effect.Effect<void, RepoError>;
  readonly stream: Stream.Stream<readonly Session[], RepoReadError>;
}

export class SessionRepo extends Context.Tag('figval/SessionRepo')<
  SessionRepo,
  SessionRepoService
>() {}

export const SessionRepoLive = Layer.effect(
  SessionRepo,
  Effect.map(ChromeStorage, (kv): SessionRepoService => {
    const sessions = makeCollection(kv, SESSIONS_KEY, {
      schema: Session,
      conflict: (existing, next) =>
        existing.id === next.id ? `duplicate session id ${next.id}` : null,
    });
    return {
      list: sessions.list,
      get: sessions.get,
      insert: sessions.insert,
      replace: sessions.replace,
      remove: sessions.remove,
      stream: sessions.stream,
    };
  }),
);
