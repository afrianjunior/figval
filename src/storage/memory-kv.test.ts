import { Chunk, Effect, Fiber, Stream } from 'effect';
import { describe, expect, it } from 'vitest';
import { makeFaultControl, makeMemoryKv } from './memory-kv';

const flush = Effect.sleep(0);

describe('memory kv', () => {
  it('stores, reads and removes values', async () => {
    const kv = makeMemoryKv();
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* kv.set('a', 1);
        const first = yield* kv.get('a');
        yield* kv.remove(['a', 'missing']);
        return [first, yield* kv.get('a')];
      }),
    );
    expect(result).toEqual([1, undefined]);
  });

  it('emits changes for set and remove', async () => {
    const kv = makeMemoryKv();
    const changes = await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* kv.changes.pipe(Stream.take(2), Stream.runCollect, Effect.fork);
        yield* flush;
        yield* kv.set('a', 1);
        yield* kv.remove(['a']);
        return Chunk.toReadonlyArray(yield* Fiber.join(fiber));
      }),
    );
    expect(changes).toEqual([
      { key: 'a', newValue: 1, oldValue: undefined },
      { key: 'a', newValue: undefined, oldValue: 1 },
    ]);
  });

  it('maps simulated faults', async () => {
    const control = makeFaultControl();
    const kv = makeMemoryKv(control);
    control.set({ kind: 'quota', bytesInUse: 42 });
    const quota = await Effect.runPromise(Effect.flip(kv.set('a', 1)));
    expect(quota).toMatchObject({ _tag: 'StorageQuotaExceeded', bytesInUse: 42 });
    control.set({ kind: 'unavailable' });
    const outage = await Effect.runPromise(Effect.flip(kv.get('a')));
    expect(outage._tag).toBe('StorageUnavailable');
    expect((await Effect.runPromise(Effect.flip(kv.set('a', 1))))._tag).toBe('StorageUnavailable');
    expect((await Effect.runPromise(Effect.flip(kv.remove(['a']))))._tag).toBe(
      'StorageUnavailable',
    );
    control.set(null);
    await Effect.runPromise(kv.set('a', 1));
  });
});
