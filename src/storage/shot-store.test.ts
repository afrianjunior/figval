// @vitest-environment node
import 'fake-indexeddb/auto';
import { Effect, Layer, Option } from 'effect';
import { describe, expect, it } from 'vitest';
import { shotId } from './fixtures';
import { ShotStore, ShotStoreMemory } from './shot-store';
import { makeShotStoreLive } from './shot-store-idb';

const blob = (text: string) => new Blob([text], { type: 'image/webp' });
const text = (b: Option.Option<Blob>) =>
  Option.isSome(b) ? b.value.text() : Promise.resolve(null);

const contract = (name: string, layer: () => Layer.Layer<ShotStore, unknown>) =>
  describe(name, () => {
    const run = <A, E>(eff: Effect.Effect<A, E, ShotStore>) =>
      Effect.runPromise(
        Effect.scoped(eff.pipe(Effect.provide(layer()))) as Effect.Effect<A, unknown>,
      );

    it('puts, gets, replaces and removes', async () => {
      const out = await run(
        Effect.gen(function* () {
          const s = yield* ShotStore;
          yield* s.put(shotId(1), blob('one'));
          const first = yield* s.get(shotId(1));
          yield* s.replace(shotId(1), blob('uno'));
          const second = yield* s.get(shotId(1));
          yield* s.remove(shotId(1));
          return { first, second, gone: yield* s.get(shotId(1)) };
        }),
      );
      expect(await text(out.first)).toBe('one');
      expect(await text(out.second)).toBe('uno');
      expect(Option.isNone(out.gone)).toBe(true);
    });

    it('removeMany deletes only the given ids', async () => {
      const out = await run(
        Effect.gen(function* () {
          const s = yield* ShotStore;
          for (const n of [1, 2, 3]) yield* s.put(shotId(n), blob(String(n)));
          yield* s.removeMany([shotId(1), shotId(2), shotId(9)]);
          return yield* Effect.forEach([1, 2, 3], (n) => s.get(shotId(n)));
        }),
      );
      expect(out.map(Option.isSome)).toEqual([false, false, true]);
    });

    it('put on an existing id fails with ShotStoreError', async () => {
      const err = await run(
        Effect.gen(function* () {
          const s = yield* ShotStore;
          yield* s.put(shotId(1), blob('a'));
          return yield* Effect.flip(s.put(shotId(1), blob('b')));
        }),
      );
      expect(err).toMatchObject({ _tag: 'ShotStoreError', op: 'put' });
    });
  });

contract('memory ShotStore', () => ShotStoreMemory);

let counter = 0;
contract('IndexedDB ShotStore', () => makeShotStoreLive(`figval-test-${counter++}`));

describe('IndexedDB lifecycle', () => {
  it('persists across connections and closes on scope end', async () => {
    const name = `figval-persist-${counter++}`;
    const write = Effect.flatMap(ShotStore, (s) => s.put(shotId(5), blob('kept')));
    await Effect.runPromise(Effect.scoped(write.pipe(Effect.provide(makeShotStoreLive(name)))));
    const read = await Effect.runPromise(
      Effect.scoped(
        Effect.flatMap(ShotStore, (s) => s.get(shotId(5))).pipe(
          Effect.provide(makeShotStoreLive(name)),
        ),
      ),
    );
    expect(await text(read)).toBe('kept');
    const deleted = await new Promise<boolean>((resolve) => {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
      req.onblocked = () => resolve(false);
    });
    expect(deleted).toBe(true);
  });

  it('maps a failed open to ShotStoreError', async () => {
    const original = globalThis.indexedDB;
    Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
    try {
      const err = await Effect.runPromise(
        Effect.flip(
          Effect.scoped(
            Effect.flatMap(ShotStore, (s) => s.get(shotId(1))).pipe(
              Effect.provide(makeShotStoreLive()),
            ),
          ),
        ),
      );
      expect(err).toMatchObject({ _tag: 'ShotStoreError', op: 'open' });
    } finally {
      Object.defineProperty(globalThis, 'indexedDB', { value: original, configurable: true });
    }
  });
});
