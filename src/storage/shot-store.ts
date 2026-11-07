import { Context, Effect, Layer, Option } from 'effect';
import { ShotStoreError, type ShotId } from '../domain';

export interface ShotStoreService {
  /** Fails with ShotStoreError when the id already exists; use `replace` to overwrite. */
  readonly put: (id: ShotId, blob: Blob) => Effect.Effect<void, ShotStoreError>;
  readonly get: (id: ShotId) => Effect.Effect<Option.Option<Blob>, ShotStoreError>;
  readonly replace: (id: ShotId, blob: Blob) => Effect.Effect<void, ShotStoreError>;
  readonly remove: (id: ShotId) => Effect.Effect<void, ShotStoreError>;
  readonly removeMany: (ids: readonly ShotId[]) => Effect.Effect<void, ShotStoreError>;
}

export class ShotStore extends Context.Tag('figval/ShotStore')<ShotStore, ShotStoreService>() {}

export const makeMemoryShotStore = (): ShotStoreService => {
  const shots = new Map<ShotId, Blob>();
  return {
    put: (id, blob) =>
      Effect.suspend(() => {
        if (shots.has(id))
          return Effect.fail(new ShotStoreError({ op: 'put', cause: 'key exists' }));
        shots.set(id, blob);
        return Effect.void;
      }),
    get: (id) => Effect.sync(() => Option.fromNullable(shots.get(id))),
    replace: (id, blob) => Effect.sync(() => void shots.set(id, blob)),
    remove: (id) => Effect.sync(() => void shots.delete(id)),
    removeMany: (ids) => Effect.sync(() => ids.forEach((id) => shots.delete(id))),
  };
};

export const ShotStoreMemory = Layer.sync(ShotStore, makeMemoryShotStore);
