import { Context, Effect, Layer, Schema } from 'effect';
import { chromeApi } from './chrome-api';
import { TestRecorder } from './test-driver';

export interface DownloadService {
  /** Saves text as a .md file. Any rejection, including the user cancelling the save dialog, is DownloadFailed. */
  readonly markdown: (filename: string, text: string) => Effect.Effect<void, DownloadFailed>;
}

export class DownloadFailed extends Schema.TaggedError<DownloadFailed>()('DownloadFailed', {
  cause: Schema.String,
}) {}

export class Download extends Context.Tag('figval/platform/Download')<Download, DownloadService>() {}

/** A data URL, because MV3 service workers have no URL.createObjectURL. */
export const markdownDataUrl = (text: string): string =>
  `data:text/markdown;charset=utf-8,${encodeURIComponent(text)}`;

export const DownloadLive: Layer.Layer<Download> = Layer.succeed(Download, {
  markdown: (filename, text) =>
    Effect.tryPromise({
      try: () => chromeApi().downloads.download({ url: markdownDataUrl(text), filename, saveAs: true }),
      catch: (e) => new DownloadFailed({ cause: e instanceof Error ? e.message : String(e) }),
    }).pipe(Effect.asVoid),
});

export interface DownloadTestConfig {
  readonly fail?: boolean;
}

export const DownloadTest = (config: DownloadTestConfig = {}): Layer.Layer<Download, never, TestRecorder> =>
  Layer.effect(
    Download,
    Effect.map(TestRecorder, (recorder): DownloadService => ({
      markdown: (filename, text) =>
        recorder
          .record({ service: 'Download', op: 'markdown', args: [filename, text] })
          .pipe(
            Effect.zipRight(
              config.fail ? Effect.fail(new DownloadFailed({ cause: 'test failure' })) : Effect.void,
            ),
          ),
    })),
  );
