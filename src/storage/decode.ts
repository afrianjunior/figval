import { Effect, Either, Schema } from 'effect';
import { StorageCorrupt } from '../domain';

/** schemaVersion migration hook. Identity in v1; later versions rewrite `raw` to the current shape. */
export const migrate = (_schemaVersion: unknown, raw: unknown): unknown => raw;

const versionOf = (raw: unknown): unknown =>
  typeof raw === 'object' && raw !== null
    ? (raw as { schemaVersion?: unknown }).schemaVersion
    : undefined;

export const decodeRecord = <A, I>(
  schema: Schema.Schema<A, I>,
  raw: unknown,
): Either.Either<A, string> =>
  Either.mapLeft(
    Schema.decodeUnknownEither(schema)(migrate(versionOf(raw), raw)),
    (e) => e.message,
  );

/** A stored array element: the untouched raw value and its decoded form (null when corrupt). */
export interface Entry<A> {
  readonly raw: unknown;
  readonly item: A | null;
}

/** Whole-key decode: the container must be an array (or absent); elements decode individually. */
export const decodeEntries = <A, I>(
  key: string,
  schema: Schema.Schema<A, I>,
  stored: unknown,
): Effect.Effect<readonly Entry<A>[], StorageCorrupt> => {
  if (stored === undefined) return Effect.succeed([]);
  if (!Array.isArray(stored)) {
    return Effect.fail(new StorageCorrupt({ key, issue: 'expected an array' }));
  }
  return Effect.succeed(
    stored.map((raw: unknown): Entry<A> => {
      const decoded = decodeRecord(schema, raw);
      return { raw, item: Either.isRight(decoded) ? decoded.right : null };
    }),
  );
};

export const decodeWhole = <A, I>(
  key: string,
  schema: Schema.Schema<A, I>,
  stored: unknown,
): Effect.Effect<A, StorageCorrupt> =>
  Either.match(decodeRecord(schema, stored), {
    onLeft: (issue) => Effect.fail(new StorageCorrupt({ key, issue })),
    onRight: Effect.succeed,
  });
