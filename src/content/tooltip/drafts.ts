import { Effect, Option } from 'effect';
import type { ForkInScope } from './session';
import type { SessionKvService } from '../../storage';
import { decodeStoredDraft, type StoredDraft } from './model/draft';

const DRAFT_DEBOUNCE_MS = 400;

/** Reads at the storage edge: anything that fails to decode is treated as "no draft". */
export const readDraft = (
  kv: SessionKvService,
  key: string,
): Effect.Effect<Option.Option<StoredDraft>> =>
  kv.get(key).pipe(
    Effect.map((raw) => (raw === undefined ? Option.none() : decodeStoredDraft(raw))),
    // divergent: an unreadable draft is the same as no draft; there is nothing to report to the user.
    Effect.orElseSucceed(() => Option.none<StoredDraft>()),
  );

export const writeDraft = (
  kv: SessionKvService,
  key: string,
  draft: StoredDraft,
): Effect.Effect<void> =>
  kv
    .set(key, draft)
    .pipe(Effect.catchAll((error) => Effect.logWarning('figval: draft not saved', error._tag)));

export const clearDraft = (kv: SessionKvService, key: string): Effect.Effect<void> =>
  kv
    .remove([key])
    .pipe(Effect.catchAll((error) => Effect.logWarning('figval: draft not cleared', error._tag)));

export interface DraftWriter {
  /** Debounced: stores `draft`, or removes the key when it is null. */
  readonly schedule: (draft: StoredDraft | null) => void;
  readonly cancel: () => void;
}

export const makeDraftWriter = (
  kv: SessionKvService,
  key: string,
  fork: ForkInScope,
): DraftWriter => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const cancel = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  return {
    cancel,
    schedule: (draft) => {
      cancel();
      timer = setTimeout(() => {
        timer = null;
        fork(draft ? writeDraft(kv, key, draft) : clearDraft(kv, key));
      }, DRAFT_DEBOUNCE_MS);
    },
  };
};
