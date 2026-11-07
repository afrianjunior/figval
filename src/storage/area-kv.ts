import { Effect, Stream } from 'effect';
import { StorageQuotaExceeded, StorageUnavailable } from '../domain';
import type { KvService, SessionKvService, StorageChange } from './types';

export interface StorageAreaLike {
  readonly get: (keys: string) => Promise<Record<string, unknown>>;
  readonly set: (items: Record<string, unknown>) => Promise<void>;
  readonly remove: (keys: string[]) => Promise<void>;
  readonly getBytesInUse: (keys: null) => Promise<number>;
  readonly setAccessLevel?: (options: { accessLevel: string }) => Promise<void>;
}

type ChangeMap = Record<string, { newValue?: unknown; oldValue?: unknown }>;
type ChangeListener = (changes: ChangeMap, areaName: string) => void;

export interface ChromeLike {
  readonly storage: {
    readonly local: StorageAreaLike;
    readonly session: StorageAreaLike;
    readonly onChanged: {
      readonly addListener: (listener: ChangeListener) => void;
      readonly removeListener: (listener: ChangeListener) => void;
    };
  };
}

export type AreaName = 'local' | 'session';

const QUOTA_PATTERN = /quota/i;

const causeMessage = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

const unavailable = (cause: unknown) => new StorageUnavailable({ cause });

const resolveChrome = (getChrome: () => ChromeLike | undefined) =>
  Effect.suspend(() => {
    const api = getChrome();
    return api === undefined
      ? Effect.fail(unavailable('chrome.storage is not available'))
      : Effect.succeed(api);
  });

const quotaFailure = (area: StorageAreaLike): Effect.Effect<never, StorageQuotaExceeded> =>
  Effect.tryPromise(() => area.getBytesInUse(null)).pipe(
    Effect.orElseSucceed(() => 0),
    Effect.flatMap((bytesInUse) => Effect.fail(new StorageQuotaExceeded({ bytesInUse }))),
  );

const toChanges = (changes: ChangeMap): readonly StorageChange[] =>
  Object.entries(changes).map(([key, c]) => ({ key, newValue: c.newValue, oldValue: c.oldValue }));

const subscribe = (api: ChromeLike, areaName: AreaName) =>
  Stream.asyncPush<StorageChange>(
    (emit) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          const listener: ChangeListener = (changes, area) => {
            if (area !== areaName) return;
            for (const change of toChanges(changes)) emit.single(change);
          };
          api.storage.onChanged.addListener(listener);
          return listener;
        }),
        (listener) => Effect.sync(() => api.storage.onChanged.removeListener(listener)),
      ),
    { bufferSize: 'unbounded' },
  );

export const makeAreaKv = (
  areaName: AreaName,
  getChrome: () => ChromeLike | undefined = () => (globalThis as { chrome?: ChromeLike }).chrome,
): KvService => {
  const area = resolveChrome(getChrome).pipe(Effect.map((api) => api.storage[areaName]));
  return {
    get: (key) =>
      area.pipe(
        Effect.flatMap((a) => Effect.tryPromise({ try: () => a.get(key), catch: unavailable })),
        Effect.map((record) => record[key]),
      ),
    set: (key, value) =>
      area.pipe(
        Effect.flatMap((a) =>
          Effect.tryPromise({ try: () => a.set({ [key]: value }), catch: (cause) => cause }).pipe(
            Effect.catchAll(
              (cause): Effect.Effect<never, StorageQuotaExceeded | StorageUnavailable> =>
                QUOTA_PATTERN.test(causeMessage(cause))
                  ? quotaFailure(a)
                  : Effect.fail(unavailable(cause)),
            ),
          ),
        ),
      ),
    remove: (keys) =>
      area.pipe(
        Effect.flatMap((a) =>
          Effect.tryPromise({ try: () => a.remove([...keys]), catch: unavailable }),
        ),
      ),
    changes: Stream.unwrapScoped(
      resolveChrome(getChrome).pipe(Effect.map((api) => subscribe(api, areaName))),
    ),
  };
};

const CONTENT_ACCESS_LEVEL = 'TRUSTED_AND_UNTRUSTED_CONTEXTS';

export const makeSessionKv = (
  getChrome: () => ChromeLike | undefined = () => (globalThis as { chrome?: ChromeLike }).chrome,
): SessionKvService => ({
  ...makeAreaKv('session', getChrome),
  allowContentAccess: resolveChrome(getChrome).pipe(
    Effect.flatMap((api) => {
      const grant = api.storage.session.setAccessLevel;
      return grant === undefined
        ? Effect.fail(unavailable('chrome.storage.session.setAccessLevel is not available'))
        : Effect.tryPromise({
            try: () => grant.call(api.storage.session, { accessLevel: CONTENT_ACCESS_LEVEL }),
            catch: unavailable,
          });
    }),
  ),
});
