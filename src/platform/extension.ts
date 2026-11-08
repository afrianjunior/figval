import { Context, Effect, Layer, Stream } from 'effect';
import { chromeApi } from './chrome-api';
import { takeEarly } from './early-events';
import { TestDriver, TestRecorder } from './test-driver';

/** `chrome.runtime.onInstalled` reasons. */
export type InstallReason = 'install' | 'update' | 'chrome_update' | 'shared_module_update';

export interface ExtensionService {
  readonly onInstalled: Stream.Stream<InstallReason>;
  /** Opens a packaged page (`/welcome.html`) in a new tab. */
  readonly openPage: (path: string) => Effect.Effect<void>;
  /** Opens an absolute url, `chrome://` included, in a new tab. */
  readonly openUrl: (url: string) => Effect.Effect<void>;
  /** Toolbar icon pinned; null when this Chrome cannot report it (no `action.getUserSettings`). */
  readonly isPinned: Effect.Effect<boolean | null>;
  /** The keyboard shortcut Chrome assigned to a command; empty when none (e.g. it clashed). */
  readonly shortcut: (command: string) => Effect.Effect<string>;
}

export class Extension extends Context.Tag('figval/platform/Extension')<Extension, ExtensionService>() {}

const logged = (label: string) => (cause: unknown) => Effect.logWarning(`${label} failed`, cause);

const openTab = (url: string) =>
  Effect.tryPromise(() => chromeApi().tabs.create({ url })).pipe(
    Effect.catchAll(logged('tabs.create')),
    Effect.asVoid,
  );

export const ExtensionLive: Layer.Layer<Extension> = Layer.succeed(Extension, {
  onInstalled: Stream.asyncPush<InstallReason>((emit) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        const listener = (details: { reason: string }) => void emit.single(details.reason as InstallReason);
        chromeApi().runtime.onInstalled.addListener(listener);
        takeEarly<{ reason: string }>('install').forEach(listener);
        return listener;
      }),
      (listener) => Effect.sync(() => chromeApi().runtime.onInstalled.removeListener(listener)),
    ),
  ),
  openPage: (path) => Effect.suspend(() => openTab(chromeApi().runtime.getURL(path as never))),
  openUrl: openTab,
  isPinned: Effect.tryPromise(() => chromeApi().action.getUserSettings()).pipe(
    Effect.map((s): boolean | null => s.isOnToolbar),
    Effect.catchAll((cause) => logged('action.getUserSettings')(cause).pipe(Effect.as(null))),
  ),
  shortcut: (command) =>
    Effect.tryPromise(() => chromeApi().commands.getAll()).pipe(
      Effect.map((all) => all.find((c) => c.name === command)?.shortcut ?? ''),
      Effect.catchAll((cause) => logged('commands.getAll')(cause).pipe(Effect.as(''))),
    ),
});

export interface ExtensionTestConfig {
  readonly pinned?: boolean | null;
  readonly shortcut?: string;
}

export const ExtensionTest = (
  config: ExtensionTestConfig = {},
): Layer.Layer<Extension, never, TestDriver | TestRecorder> =>
  Layer.effect(
    Extension,
    Effect.gen(function* () {
      const driver = yield* TestDriver;
      const recorder = yield* TestRecorder;
      return {
        onInstalled: Stream.fromPubSub(driver.installEvents),
        openPage: (path) => recorder.record({ service: 'Extension', op: 'openPage', args: [path] }),
        openUrl: (url) => recorder.record({ service: 'Extension', op: 'openUrl', args: [url] }),
        isPinned: recorder
          .record({ service: 'Extension', op: 'isPinned', args: [] })
          .pipe(Effect.as(config.pinned === undefined ? false : config.pinned)),
        shortcut: () => Effect.succeed(config.shortcut ?? 'Alt+Shift+F'),
      } satisfies ExtensionService;
    }),
  );
