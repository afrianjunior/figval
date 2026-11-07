import { Context, Effect, Layer } from 'effect';
import { chromeApi } from './chrome-api';
import { TestRecorder } from './test-driver';

export interface DownloadService {
  /** Saves text as a .md file. Failure is a defect: the downloads permission is declared in the manifest. */
  readonly markdown: (filename: string, text: string) => Effect.Effect<void>;
}

export class Download extends Context.Tag('figval/platform/Download')<Download, DownloadService>() {}

/** A data URL, because MV3 service workers have no URL.createObjectURL. */
export const markdownDataUrl = (text: string): string =>
  `data:text/markdown;charset=utf-8,${encodeURIComponent(text)}`;

export const DownloadLive: Layer.Layer<Download> = Layer.succeed(Download, {
  markdown: (filename, text) =>
    Effect.tryPromise(() =>
      chromeApi().downloads.download({ url: markdownDataUrl(text), filename, saveAs: true }),
    ).pipe(Effect.asVoid, Effect.orDie),
});

export const DownloadTest: Layer.Layer<Download, never, TestRecorder> = Layer.effect(
  Download,
  Effect.map(TestRecorder, (recorder): DownloadService => ({
    markdown: (filename, text) => recorder.record({ service: 'Download', op: 'markdown', args: [filename, text] }),
  })),
);
