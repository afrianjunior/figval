import { Effect, Layer, Option } from 'effect';
import { ShotStoreError, type ShotId } from '../domain';
import { ShotStore, type ShotStoreService } from './shot-store';

export const SHOT_DB_NAME = 'figval-shots';
const STORE = 'shots';
const OPEN_OP = 'open';

const request = <T>(op: string, make: () => IDBRequest<T>): Effect.Effect<T, ShotStoreError> =>
  Effect.async((resume) => {
    try {
      const req = make();
      req.onsuccess = () => resume(Effect.succeed(req.result));
      req.onerror = () => resume(Effect.fail(new ShotStoreError({ op, cause: req.error })));
    } catch (cause) {
      resume(Effect.fail(new ShotStoreError({ op, cause })));
    }
  });

const openDb = (name: string): Effect.Effect<IDBDatabase, ShotStoreError> =>
  Effect.async((resume) => {
    try {
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = () => void req.result.createObjectStore(STORE);
      req.onsuccess = () => resume(Effect.succeed(req.result));
      req.onerror = () => resume(Effect.fail(new ShotStoreError({ op: 'open', cause: req.error })));
      req.onblocked = () =>
        resume(Effect.fail(new ShotStoreError({ op: 'open', cause: 'upgrade blocked' })));
    } catch (cause) {
      resume(Effect.fail(new ShotStoreError({ op: OPEN_OP, cause })));
    }
  });

const makeService = (db: IDBDatabase): ShotStoreService => {
  const objectStore = (mode: IDBTransactionMode) => db.transaction(STORE, mode).objectStore(STORE);
  const del = (id: ShotId) => request('remove', () => objectStore('readwrite').delete(id));
  return {
    put: (id, blob) =>
      request('put', () => objectStore('readwrite').add(blob, id)).pipe(Effect.asVoid),
    replace: (id, blob) =>
      request('replace', () => objectStore('readwrite').put(blob, id)).pipe(Effect.asVoid),
    get: (id) =>
      request<unknown>('get', () => objectStore('readonly').get(id)).pipe(
        Effect.map((value) => (value instanceof Blob ? Option.some(value) : Option.none())),
      ),
    remove: (id) => del(id).pipe(Effect.asVoid),
    removeMany: (ids) => Effect.forEach(ids, del, { discard: true }),
  };
};

/** The connection is opened on build and closed when the layer's scope ends. */
export const makeShotStoreLive = (dbName: string = SHOT_DB_NAME) =>
  Layer.scoped(
    ShotStore,
    Effect.acquireRelease(openDb(dbName), (db) => Effect.sync(() => db.close())).pipe(
      Effect.map(makeService),
    ),
  );

export const ShotStoreLive = makeShotStoreLive();
