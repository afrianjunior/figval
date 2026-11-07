import { Context, Effect, Layer } from 'effect';
import { CaptureFailed } from '../domain';
import { chromeApi } from './chrome-api';
import { cropToWebp, fixedWebp } from './image';
import { TestRecorder } from './test-driver';
import type { Rect } from './types';

export interface CaptureService {
  /** PNG data URL of the visible area of the window's active tab. */
  readonly visibleTab: (windowId: number) => Effect.Effect<string, CaptureFailed>;
  /** Crop by rect (CSS px) × dpr and encode as WebP. */
  readonly crop: (dataUrl: string, rect: Rect, dpr: number) => Effect.Effect<Blob, CaptureFailed>;
}

export class Capture extends Context.Tag('figval/platform/Capture')<Capture, CaptureService>() {}

const failed = (cause: unknown) =>
  new CaptureFailed({ reason: cause instanceof Error ? cause.message : String(cause) });

export const CaptureLive: Layer.Layer<Capture> = Layer.succeed(Capture, {
  visibleTab: (windowId) =>
    Effect.tryPromise({
      try: () => chromeApi().tabs.captureVisibleTab(windowId, { format: 'png' }),
      catch: failed,
    }),
  crop: (dataUrl, rect, dpr) => Effect.tryPromise({ try: () => cropToWebp(dataUrl, rect, dpr), catch: failed }),
});

export const FIXED_SCREENSHOT_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

export interface CaptureTestConfig {
  readonly failWith?: string;
}

export const CaptureTest = (config: CaptureTestConfig = {}): Layer.Layer<Capture, never, TestRecorder> =>
  Layer.effect(
    Capture,
    Effect.map(TestRecorder, (recorder): CaptureService => {
      const gate = (op: string, args: readonly unknown[]) =>
        recorder.record({ service: 'Capture', op, args }).pipe(
          Effect.zipRight(
            config.failWith === undefined ? Effect.void : Effect.fail(new CaptureFailed({ reason: config.failWith })),
          ),
        );
      return {
        visibleTab: (windowId) => gate('visibleTab', [windowId]).pipe(Effect.as(FIXED_SCREENSHOT_DATA_URL)),
        crop: (_dataUrl, rect, dpr) => gate('crop', [rect, dpr]).pipe(Effect.map(fixedWebp)),
      };
    }),
  );
