import { Effect, Fiber, Scope, SubscriptionRef } from 'effect';
import type { Clipboard, Download, Permissions, Tabs } from '../../platform';
import { Clock } from '../../platform';
import type { Messenger } from '../../messaging';
import type { NoteRepo, SessionRepo, SessionStore, SettingsRepo, ShotStore } from '../../storage';
import type { NoteId, NotePatch, TabId } from '../../domain';
import { ERROR_TAGS } from '../../copy';
import type { ErrorTag } from '../../domain';
import { withError, withoutError, withUi, type ErrorKey, type ModelState } from './state';

export type PanelEnv =
  | Messenger
  | Tabs
  | Permissions
  | Clipboard
  | Download
  | Clock
  | ShotStore
  | SettingsRepo
  | SessionRepo
  | NoteRepo
  | SessionStore;

export const NOTE_DEBOUNCE_MS = 400;
export const UNDO_WINDOW_MS = 5000;
export const FLASH_MS = 1500;
export const BOUND_TAB_POLL_MS = 1000;

export interface PendingPatch {
  readonly patch: NotePatch;
  readonly fiber: Fiber.RuntimeFiber<void>;
}

/** Mutable coordination handles for scoped timer fibers; model data itself stays in `ref`. */
export interface Ctx {
  readonly ref: SubscriptionRef.SubscriptionRef<ModelState>;
  readonly scope: Scope.Scope;
  readonly boundTabId: TabId | undefined;
  readonly boundTabPollMs: number;
  readonly debounces: Map<NoteId, PendingPatch>;
  deleteTimer: Fiber.RuntimeFiber<void> | null;
  flashTimer: Fiber.RuntimeFiber<void> | null;
}

const knownTags: ReadonlySet<string> = new Set(ERROR_TAGS);

/** Folds any action failure into the copy error tag the UI looks up. */
export const toErrorTag = (e: unknown): ErrorTag => {
  if (typeof e !== 'object' || e === null || !('_tag' in e)) return 'InvariantViolation';
  const tag = e._tag === 'RemoteFailure' && 'tag' in e ? e.tag : e._tag;
  return typeof tag === 'string' && knownTags.has(tag) ? (tag as ErrorTag) : 'InvariantViolation';
};

export const getState = (ctx: Ctx): Effect.Effect<ModelState> => SubscriptionRef.get(ctx.ref);

export const update = (ctx: Ctx, f: (s: ModelState) => ModelState): Effect.Effect<void> =>
  SubscriptionRef.update(ctx.ref, f);

export const failTo =
  (ctx: Ctx, key: ErrorKey) =>
  (e: unknown): Effect.Effect<void> =>
    update(ctx, (s) => withError(s, key, toErrorTag(e)));

export const clearError = (ctx: Ctx, key: ErrorKey): Effect.Effect<void> =>
  update(ctx, (s) => withoutError(s, key));

/** Marks a transient success (copied, saved) for FLASH_MS. */
export const flash = (ctx: Ctx, id: string): Effect.Effect<void> =>
  Effect.gen(function* () {
    if (ctx.flashTimer !== null) yield* Fiber.interrupt(ctx.flashTimer);
    yield* update(ctx, (s) => withUi(s, { flashId: id }));
    ctx.flashTimer = yield* Effect.sleep(FLASH_MS).pipe(
      Effect.zipRight(update(ctx, (s) => withUi(s, { flashId: null }))),
      Effect.forkIn(ctx.scope),
    );
  });

export const nowMs: Effect.Effect<number, never, Clock> = Effect.flatMap(Clock, (c) => c.now);
