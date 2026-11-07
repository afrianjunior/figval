import { Chunk, Effect, Fiber, Stream } from 'effect';
import { describe, expect, it } from 'vitest';
import { makeAreaKv, makeSessionKv, type ChromeLike, type StorageAreaLike } from './area-kv';

type Listener = Parameters<ChromeLike['storage']['onChanged']['addListener']>[0];

const makeFakeChrome = (
  opts: { setError?: Error; bytes?: number; accessError?: Error; noAccess?: boolean } = {},
) => {
  const accessCalls: unknown[] = [];
  const listeners = new Set<Listener>();
  const data = new Map<string, unknown>();
  const area = (): StorageAreaLike => ({
    get: async (key) => (data.has(key) ? { [key]: data.get(key) } : {}),
    set: async (items) => {
      if (opts.setError) throw opts.setError;
      Object.entries(items).forEach(([k, v]) => data.set(k, v));
    },
    remove: async (keys) => keys.forEach((k) => data.delete(k)),
    ...(opts.noAccess
      ? {}
      : {
          setAccessLevel: async (o: { accessLevel: string }) => {
            accessCalls.push(o);
            if (opts.accessError) throw opts.accessError;
          },
        }),
    getBytesInUse: async () => {
      if (opts.bytes === undefined) throw new Error('no bytes');
      return opts.bytes;
    },
  });
  const chrome: ChromeLike = {
    storage: {
      local: area(),
      session: area(),
      onChanged: {
        addListener: (l) => void listeners.add(l),
        removeListener: (l) => void listeners.delete(l),
      },
    },
  };
  return { chrome, listeners, accessCalls };
};

describe('chrome.storage adapter', () => {
  it('round-trips values', async () => {
    const { chrome } = makeFakeChrome();
    const kv = makeAreaKv('local', () => chrome);
    const out = await Effect.runPromise(
      Effect.gen(function* () {
        yield* kv.set('k', { a: 1 });
        const value = yield* kv.get('k');
        yield* kv.remove(['k']);
        return [value, yield* kv.get('k')];
      }),
    );
    expect(out).toEqual([{ a: 1 }, undefined]);
  });

  it('maps quota errors with bytes in use', async () => {
    const { chrome } = makeFakeChrome({
      setError: new Error('QUOTA_BYTES quota exceeded'),
      bytes: 9000,
    });
    const err = await Effect.runPromise(Effect.flip(makeAreaKv('local', () => chrome).set('k', 1)));
    expect(err).toMatchObject({ _tag: 'StorageQuotaExceeded', bytesInUse: 9000 });
  });

  it('falls back to 0 bytes when usage is unreadable', async () => {
    const { chrome } = makeFakeChrome({ setError: new Error('Quota exceeded') });
    const err = await Effect.runPromise(Effect.flip(makeAreaKv('local', () => chrome).set('k', 1)));
    expect(err).toMatchObject({ _tag: 'StorageQuotaExceeded', bytesInUse: 0 });
  });

  it('maps other failures to StorageUnavailable', async () => {
    const { chrome } = makeFakeChrome({ setError: new Error('boom') });
    const err = await Effect.runPromise(Effect.flip(makeAreaKv('local', () => chrome).set('k', 1)));
    expect(err._tag).toBe('StorageUnavailable');
  });

  it('fails with StorageUnavailable when chrome.storage is missing', async () => {
    const kv = makeAreaKv('local', () => undefined);
    expect((await Effect.runPromise(Effect.flip(kv.get('k'))))._tag).toBe('StorageUnavailable');
    expect((await Effect.runPromise(Effect.flip(kv.changes.pipe(Stream.runDrain))))._tag).toBe(
      'StorageUnavailable',
    );
  });

  it('streams only changes of its own area and unsubscribes on release', async () => {
    const { chrome, listeners } = makeFakeChrome();
    const kv = makeAreaKv('session', () => chrome);
    const out = await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* kv.changes.pipe(Stream.take(1), Stream.runCollect, Effect.fork);
        yield* Effect.sleep(0);
        const subscribed = listeners.size;
        listeners.forEach((l) => {
          l({ x: { newValue: 0 } }, 'local');
          l({ k: { newValue: 2, oldValue: 1 } }, 'session');
        });
        const changes = Chunk.toReadonlyArray(yield* Fiber.join(fiber));
        return { subscribed, changes, after: listeners.size };
      }),
    );
    expect(out.subscribed).toBe(1);
    expect(out.changes).toEqual([{ key: 'k', newValue: 2, oldValue: 1 }]);
    expect(out.after).toBe(0);
  });
});

describe('session store content access', () => {
  it('grants TRUSTED_AND_UNTRUSTED_CONTEXTS access', async () => {
    const { chrome, accessCalls } = makeFakeChrome();
    await Effect.runPromise(makeSessionKv(() => chrome).allowContentAccess);
    expect(accessCalls).toEqual([{ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' }]);
  });

  it('maps a rejection to StorageUnavailable', async () => {
    const { chrome } = makeFakeChrome({ accessError: new Error('denied') });
    const err = await Effect.runPromise(
      Effect.flip(makeSessionKv(() => chrome).allowContentAccess),
    );
    expect(err._tag).toBe('StorageUnavailable');
  });

  it('fails when setAccessLevel is unsupported or chrome is missing', async () => {
    const { chrome } = makeFakeChrome({ noAccess: true });
    const unsupported = await Effect.runPromise(
      Effect.flip(makeSessionKv(() => chrome).allowContentAccess),
    );
    const missing = await Effect.runPromise(
      Effect.flip(makeSessionKv(() => undefined).allowContentAccess),
    );
    expect([unsupported._tag, missing._tag]).toEqual(['StorageUnavailable', 'StorageUnavailable']);
  });
});
