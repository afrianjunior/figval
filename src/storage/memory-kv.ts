import { Effect, Stream } from 'effect';
import { StorageQuotaExceeded, StorageUnavailable } from '../domain';
import type { KvService, StorageChange } from './types';

export type Fault =
  { readonly kind: 'unavailable' } | { readonly kind: 'quota'; readonly bytesInUse: number };

/** Test handle: flip the memory layer into a failing mode and back. */
export interface FaultControl {
  readonly set: (fault: Fault | null) => void;
  readonly current: () => Fault | null;
}

export const makeFaultControl = (): FaultControl => {
  let fault: Fault | null = null;
  return {
    set: (next) => {
      fault = next;
    },
    current: () => fault,
  };
};

const failUnavailable = () => Effect.fail(new StorageUnavailable({ cause: 'simulated outage' }));

export const makeMemoryKv = (control: FaultControl = makeFaultControl()): KvService => {
  const data = new Map<string, unknown>();
  const listeners = new Set<(change: StorageChange) => void>();
  const emit = (change: StorageChange) => listeners.forEach((l) => l(change));

  const guarded = <A>(run: () => Effect.Effect<A>): Effect.Effect<A, StorageUnavailable> =>
    Effect.suspend(() => (control.current()?.kind === 'unavailable' ? failUnavailable() : run()));

  return {
    get: (key) => guarded(() => Effect.sync(() => data.get(key))),
    set: (key, value) =>
      Effect.suspend((): Effect.Effect<void, StorageUnavailable | StorageQuotaExceeded> => {
        const fault = control.current();
        if (fault?.kind === 'unavailable') return failUnavailable();
        if (fault?.kind === 'quota') {
          return Effect.fail(new StorageQuotaExceeded({ bytesInUse: fault.bytesInUse }));
        }
        const oldValue = data.get(key);
        data.set(key, value);
        emit({ key, newValue: value, oldValue });
        return Effect.void;
      }),
    remove: (keys) =>
      guarded(() =>
        Effect.sync(() => {
          for (const key of keys) {
            if (!data.has(key)) continue;
            const oldValue = data.get(key);
            data.delete(key);
            emit({ key, newValue: undefined, oldValue });
          }
        }),
      ),
    changes: Stream.asyncPush<StorageChange>(
      (push) =>
        Effect.acquireRelease(
          Effect.sync(() => {
            const listener = (change: StorageChange) => void push.single(change);
            listeners.add(listener);
            return listener;
          }),
          (listener) => Effect.sync(() => void listeners.delete(listener)),
        ),
      { bufferSize: 'unbounded' },
    ),
  };
};
