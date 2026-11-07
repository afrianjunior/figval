import { Effect, Option, Schema, Stream } from 'effect';
import { InvariantViolation } from '../domain';
import { decodeEntries, type Entry } from './decode';
import type { KvService, Listing, RepoError, RepoReadError } from './types';

export interface CollectionSpec<A extends { readonly id: string }, I> {
  readonly schema: Schema.Schema<A, I>;
  /** Describes why `next` clashes with `existing`, or null when they can coexist. */
  readonly conflict: (existing: A, next: A) => string | null;
}

export interface Collection<A extends { readonly id: string }> {
  readonly list: Effect.Effect<Listing<A>, RepoReadError>;
  readonly get: (id: string) => Effect.Effect<Option.Option<A>, RepoReadError>;
  readonly insert: (item: A) => Effect.Effect<void, RepoError>;
  readonly replace: (item: A) => Effect.Effect<void, RepoError>;
  readonly remove: (id: string) => Effect.Effect<void, RepoError>;
  readonly removeAll: Effect.Effect<void, RepoReadError>;
  readonly stream: Stream.Stream<readonly A[], RepoReadError>;
}

const toListing = <A>(entries: readonly Entry<A>[]): Listing<A> => ({
  items: entries.flatMap((e) => (e.item === null ? [] : [e.item])),
  corrupt: entries.filter((e) => e.item === null).length,
});

const die = (what: string) => Effect.die(new InvariantViolation({ what }));

/** Array-of-records stored under one key. Corrupt elements are skipped on read and preserved on write. */
export const makeCollection = <A extends { readonly id: string }, I>(
  kv: KvService,
  key: string,
  spec: CollectionSpec<A, I>,
): Collection<A> => {
  const entries = kv
    .get(key)
    .pipe(Effect.flatMap((stored) => decodeEntries(key, spec.schema, stored)));
  const encode = (item: A) => Schema.encode(spec.schema)(item).pipe(Effect.orDie);
  const write = (raws: readonly unknown[]) => kv.set(key, raws);
  const idOf = (e: Entry<A>) => e.item?.id;

  const list = entries.pipe(Effect.map(toListing));
  const insert = (item: A) =>
    Effect.gen(function* () {
      const current = yield* entries;
      const clash = current
        .flatMap((e) => (e.item ? [spec.conflict(e.item, item)] : []))
        .find(Boolean);
      if (clash) return yield* die(clash);
      yield* write([...current.map((e) => e.raw), yield* encode(item)]);
    });
  const replace = (item: A) =>
    Effect.gen(function* () {
      const current = yield* entries;
      if (!current.some((e) => idOf(e) === item.id))
        return yield* die(`unknown id ${item.id} in ${key}`);
      const encoded = yield* encode(item);
      yield* write(current.map((e) => (idOf(e) === item.id ? encoded : e.raw)));
    });

  return {
    list,
    get: (id) =>
      list.pipe(Effect.map((l) => Option.fromNullable(l.items.find((i) => i.id === id)))),
    insert,
    replace,
    remove: (id) =>
      entries.pipe(
        Effect.flatMap((current) => write(current.filter((e) => idOf(e) !== id).map((e) => e.raw))),
      ),
    removeAll: kv.remove([key]),
    stream: Stream.merge(
      Stream.make(null),
      kv.changes.pipe(Stream.filter((c) => c.key === key)),
    ).pipe(
      Stream.mapEffect(() => list),
      Stream.map((l) => l.items),
    ),
  };
};
