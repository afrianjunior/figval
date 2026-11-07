import { Context, Effect, Layer } from 'effect';
import { ClipboardDenied } from '../domain';
import { webpToPng } from './image';
import { TestRecorder } from './test-driver';

export interface ClipboardService {
  readonly writeText: (text: string) => Effect.Effect<void, ClipboardDenied>;
  /** Takes WebP (the stored format), converts to PNG, writes an image/png ClipboardItem. */
  readonly writeImage: (webp: Blob) => Effect.Effect<void, ClipboardDenied>;
}

export class Clipboard extends Context.Tag('figval/platform/Clipboard')<Clipboard, ClipboardService>() {}

const denied = (cause: unknown) => new ClipboardDenied({ cause });

export const ClipboardLive: Layer.Layer<Clipboard> = Layer.succeed(Clipboard, {
  writeText: (text) => Effect.tryPromise({ try: () => navigator.clipboard.writeText(text), catch: denied }),
  writeImage: (webp) =>
    Effect.tryPromise({
      // The promise form keeps the user gesture alive while the PNG is produced.
      try: () => navigator.clipboard.write([new ClipboardItem({ 'image/png': webpToPng(webp) })]),
      catch: denied,
    }),
});

export type ClipboardWrite =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'image'; readonly blob: Blob };

export interface ClipboardTestConfig {
  readonly deny?: boolean;
}

export const ClipboardTest = (config: ClipboardTestConfig = {}): Layer.Layer<Clipboard, never, TestRecorder> =>
  Layer.effect(
    Clipboard,
    Effect.map(TestRecorder, (recorder): ClipboardService => {
      const write = (op: string, arg: unknown) =>
        config.deny
          ? Effect.fail(denied('test denied'))
          : recorder.record({ service: 'Clipboard', op, args: [arg] });
      return {
        writeText: (text) => write('writeText', text),
        writeImage: (blob) => write('writeImage', blob),
      };
    }),
  );
