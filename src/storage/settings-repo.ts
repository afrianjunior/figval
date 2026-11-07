import { Context, Effect, Layer, Stream } from 'effect';
import { Settings, defaultSettings } from '../domain';
import { decodeWhole } from './decode';
import { SETTINGS_KEY } from './keys';
import { ChromeStorage } from './services';
import type { RepoError, RepoReadError } from './types';

export interface SettingsRepoService {
  readonly get: Effect.Effect<Settings, RepoReadError>;
  readonly put: (settings: Settings) => Effect.Effect<void, RepoError>;
  readonly stream: Stream.Stream<Settings, RepoReadError>;
}

export class SettingsRepo extends Context.Tag('figval/SettingsRepo')<
  SettingsRepo,
  SettingsRepoService
>() {}

export const SettingsRepoLive = Layer.effect(
  SettingsRepo,
  Effect.map(ChromeStorage, (kv): SettingsRepoService => {
    const get = kv
      .get(SETTINGS_KEY)
      .pipe(
        Effect.flatMap((stored) =>
          stored === undefined
            ? Effect.succeed(defaultSettings)
            : decodeWhole(SETTINGS_KEY, Settings, stored),
        ),
      );
    return {
      get,
      put: (settings) => kv.set(SETTINGS_KEY, settings),
      stream: Stream.merge(
        Stream.make(null),
        kv.changes.pipe(Stream.filter((c) => c.key === SETTINGS_KEY)),
      ).pipe(Stream.mapEffect(() => get)),
    };
  }),
);
