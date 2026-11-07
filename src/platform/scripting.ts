import { Context, Effect, Layer } from 'effect';
import { InjectionFailed, type TabId } from '../domain';
import { chromeApi } from './chrome-api';
import { TestRecorder } from './test-driver';

export const CONTENT_SCRIPT_FILE = '/content-scripts/content.js';

export interface ScriptingService {
  /**
   * Idempotent: runs `ping` first and skips injection when it succeeds. The caller supplies the ping
   * (a short-timeout, no-retry Messenger call) so platform stays free of messaging.
   */
  readonly injectContent: (
    tabId: TabId,
    ping?: Effect.Effect<unknown, unknown>,
  ) => Effect.Effect<void, InjectionFailed>;
}

export class Scripting extends Context.Tag('figval/platform/Scripting')<Scripting, ScriptingService>() {}

const withPing = (ping: Effect.Effect<unknown, unknown> | undefined, inject: Effect.Effect<void, InjectionFailed>) =>
  ping === undefined
    ? inject
    : ping.pipe(Effect.matchEffect({ onSuccess: () => Effect.void, onFailure: () => inject }));

export const ScriptingLive: Layer.Layer<Scripting> = Layer.succeed(Scripting, {
  injectContent: (tabId, ping) =>
    withPing(
      ping,
      Effect.tryPromise({
        try: () => chromeApi().scripting.executeScript({ target: { tabId }, files: [CONTENT_SCRIPT_FILE] }),
        catch: (cause) => new InjectionFailed({ tabId, cause }),
      }).pipe(Effect.asVoid),
    ),
});

export interface ScriptingTestConfig {
  /** Tabs where the content script is already alive (ping succeeds). */
  readonly alive?: readonly TabId[];
  /** Tabs where executeScript fails. */
  readonly failing?: readonly TabId[];
}

export const ScriptingTest = (config: ScriptingTestConfig = {}): Layer.Layer<Scripting, never, TestRecorder> =>
  Layer.effect(
    Scripting,
    Effect.map(TestRecorder, (recorder): ScriptingService => ({
      injectContent: (tabId, ping) =>
        withPing(
          ping ?? (config.alive?.includes(tabId) ? Effect.void : Effect.fail('no content script')),
          recorder.record({ service: 'Scripting', op: 'injectContent', args: [tabId] }).pipe(
            Effect.zipRight(
              config.failing?.includes(tabId)
                ? Effect.fail(new InjectionFailed({ tabId, cause: 'test' }))
                : Effect.void,
            ),
          ),
        ),
    })),
  );
