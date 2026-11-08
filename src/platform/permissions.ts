import { Context, Effect, Layer } from 'effect';
import { PermissionDenied } from '../domain';
import { chromeApi } from './chrome-api';
import { TestRecorder } from './test-driver';

export interface PermissionsService {
  /** `origin` like `https://example.com`; resolves when site access is held or granted. */
  readonly ensureOrigin: (origin: string) => Effect.Effect<void, PermissionDenied>;
}

export class Permissions extends Context.Tag('figval/platform/Permissions')<Permissions, PermissionsService>() {}

export const originPattern = (origin: string): string => `${origin.replace(/\/+$/, '')}/*`;

export const PermissionsLive: Layer.Layer<Permissions> = Layer.succeed(Permissions, {
  // request() must be the first await: any earlier await (e.g. contains()) drops the click's user
  // gesture and Chrome rejects the prompt. request() resolves true without a prompt when already held.
  ensureOrigin: (origin) => {
    const deny = () => new PermissionDenied({ origin });
    return Effect.tryPromise({
      try: () => chromeApi().permissions.request({ origins: [originPattern(origin)] }),
      catch: deny,
    }).pipe(Effect.filterOrFail((granted) => granted, deny), Effect.asVoid);
  },
});

export interface PermissionsTestConfig {
  readonly granted?: readonly string[];
  /** Whether a request() prompt is accepted. Default true. */
  readonly acceptPrompt?: boolean;
}

export const PermissionsTest = (config: PermissionsTestConfig = {}): Layer.Layer<Permissions, never, TestRecorder> =>
  Layer.effect(
    Permissions,
    Effect.map(TestRecorder, (recorder): PermissionsService => ({
      ensureOrigin: (origin) =>
        recorder.record({ service: 'Permissions', op: 'ensureOrigin', args: [origin] }).pipe(
          Effect.zipRight(
            config.granted?.includes(origin) || (config.acceptPrompt ?? true)
              ? Effect.void
              : Effect.fail(new PermissionDenied({ origin })),
          ),
        ),
    })),
  );
