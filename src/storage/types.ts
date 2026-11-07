import type { Effect, Stream } from 'effect';
import type { StorageCorrupt, StorageQuotaExceeded, StorageUnavailable } from '../domain';

export interface StorageChange {
  readonly key: string;
  readonly newValue: unknown;
  readonly oldValue: unknown;
}

/** Key-value surface shared by chrome.storage.local and chrome.storage.session. */
export interface KvService {
  readonly get: (key: string) => Effect.Effect<unknown, StorageUnavailable>;
  readonly set: (
    key: string,
    value: unknown,
  ) => Effect.Effect<void, StorageUnavailable | StorageQuotaExceeded>;
  readonly remove: (keys: readonly string[]) => Effect.Effect<void, StorageUnavailable>;
  readonly changes: Stream.Stream<StorageChange, StorageUnavailable>;
}

/** The only errors repos expose; consumers never see deeper layers. */
export type RepoError = StorageQuotaExceeded | StorageCorrupt | StorageUnavailable;
export type RepoReadError = StorageCorrupt | StorageUnavailable;

/** Decoded records plus the number of records skipped because they failed to decode. */
export interface Listing<A> {
  readonly items: readonly A[];
  readonly corrupt: number;
}
