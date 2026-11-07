import { Duration, Effect } from 'effect';
import type { Shots, TabId } from '../domain';
import { Messenger } from '../messaging';
import { Capture, Ids, type Rect } from '../platform';
import { ShotStore } from '../storage';

/** captureVisibleTab allows roughly two calls per second. */
export const CAPTURE_GAP = Duration.millis(550);
export const noShots: Shots = { before: null, after: null };

/** CSS px added on every side of the element rect so outlines and shadows stay in the shot. */
export const CROP_PADDING = 4;

interface Viewport {
  readonly w: number;
  readonly h: number;
}

/** Pads the element rect and clamps it to the viewport (CSS px). Off-screen rects fall back to the viewport. */
export const cropRect = (rect: Rect | undefined, viewport: Viewport): Rect => {
  const full: Rect = { x: 0, y: 0, w: viewport.w, h: viewport.h };
  if (rect === undefined) return full;
  const x = Math.max(0, rect.x - CROP_PADDING);
  const y = Math.max(0, rect.y - CROP_PADDING);
  const right = Math.min(viewport.w, rect.x + rect.w + CROP_PADDING);
  const bottom = Math.min(viewport.h, rect.y + rect.h + CROP_PADDING);
  return right > x && bottom > y ? { x, y, w: right - x, h: bottom - y } : full;
};

export interface CaptureTarget {
  readonly tabId: TabId;
  readonly windowId: number;
  readonly rect: Rect;
  readonly dpr: number;
}

const grab = (target: CaptureTarget) =>
  Effect.gen(function* () {
    const capture = yield* Capture;
    const dataUrl = yield* capture.visibleTab(target.windowId);
    return yield* capture.crop(dataUrl, target.rect, target.dpr);
  });

const withContent = (tabId: TabId, tag: 'UiHide' | 'UiShow' | 'EditsOff' | 'EditsOn') =>
  Effect.flatMap(Messenger, (m) => m.toContent(tabId, { _tag: tag }));

const restore = (tabId: TabId, tag: 'UiShow' | 'EditsOn') =>
  withContent(tabId, tag).pipe(
    // divergent: restore runs in a finalizer; a failure must not replace the capture result, so log and swallow
    Effect.catchAll((e) => Effect.logWarning(`restore ${tag} failed: ${e._tag}`)),
  );

/** Hide the tooltip, grab the page, always show the tooltip again. */
const hidden = <A, E, R>(tabId: TabId, body: Effect.Effect<A, E, R>) =>
  withContent(tabId, 'UiHide').pipe(
    Effect.zipRight(body),
    Effect.ensuring(restore(tabId, 'UiShow')),
  );

/** With edits: before = edits off, after = edits on. Without: one shot, stored as `before`. */
const grabBlobs = (target: CaptureTarget, withEdits: boolean) =>
  withEdits
    ? Effect.gen(function* () {
        yield* withContent(target.tabId, 'EditsOff');
        const before = yield* grab(target).pipe(Effect.ensuring(restore(target.tabId, 'EditsOn')));
        yield* Effect.sleep(CAPTURE_GAP);
        const after = yield* grab(target);
        return { before, after } as const;
      })
    : Effect.map(grab(target), (before) => ({ before, after: null }));

const storeBlobs = (blobs: { readonly before: Blob; readonly after: Blob | null }) =>
  Effect.gen(function* () {
    const ids = yield* Ids;
    const store = yield* ShotStore;
    const before = yield* ids.shotId;
    const after = blobs.after === null ? null : yield* ids.shotId;
    const stored = [before, ...(after === null ? [] : [after])];
    yield* Effect.all([
      store.put(before, blobs.before),
      ...(after === null || blobs.after === null ? [] : [store.put(after, blobs.after)]),
    ]).pipe(
      Effect.tapError(() =>
        // divergent: cleanup after a failed put is best effort; the put error is what escapes
        store
          .removeMany(stored)
          .pipe(Effect.catchAll((e) => Effect.logWarning(`shot cleanup failed: ${e._tag}`))),
      ),
    );
    return { before, after } satisfies Shots;
  });

/**
 * Capture pipeline. Any failure (messaging, capture, shot store) escapes as "no shots":
 * the note is still saved and the detail shows "No screenshot" (§6).
 */
export const captureShots = (target: CaptureTarget, withEdits: boolean) =>
  hidden(target.tabId, grabBlobs(target, withEdits).pipe(Effect.flatMap(storeBlobs))).pipe(
    // divergent: any capture failure escapes as "no shots" so the note still saves (§6)
    Effect.catchAll((e) =>
      Effect.logWarning(`capture skipped: ${e._tag}`).pipe(Effect.as(noShots)),
    ),
  );

/** Single fresh shot of the page as it is now (edits applied), used when edits change. */
export const captureCurrent = (target: CaptureTarget) => hidden(target.tabId, grab(target));
