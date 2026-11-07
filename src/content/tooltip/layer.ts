import { Effect, Exit, Layer, Scope } from 'effect';
import { Messenger } from '../../messaging';
import { NoteRepo, SessionRepo, SessionStore, SettingsRepo } from '../../storage';
import { TooltipPort } from '../picker';
import { openSession, type TooltipDeps, type TooltipHandle } from './controller';

export interface TooltipLayerOptions {
  /** Maps an emitted asset path to a URL; only used when the page has no Figval fonts yet. */
  readonly resolveAsset?: (path: string) => string;
}

/** TooltipPort backed by the Shadow DOM tooltip; at most one tooltip is open at a time. */
export const makeTooltipPortLive = (
  options: TooltipLayerOptions = {},
): Layer.Layer<
  TooltipPort,
  never,
  Messenger | SessionStore | SettingsRepo | SessionRepo | NoteRepo
> =>
  Layer.scoped(
    TooltipPort,
    Effect.gen(function* () {
      const deps: TooltipDeps = {
        messenger: yield* Messenger,
        sessionStore: yield* SessionStore,
        settings: yield* SettingsRepo,
        sessions: yield* SessionRepo,
        notes: yield* NoteRepo,
      };
      const resolveAsset = options.resolveAsset ?? ((path: string) => path);
      // DOM-side bookkeeping: the one open tooltip, replaced when another opens.
      let current: TooltipHandle | null = null;

      const closeCurrent = Effect.suspend(() => {
        const open = current;
        current = null;
        return open ? open.cancel : Effect.void;
      });
      yield* Effect.addFinalizer(() => closeCurrent);

      return {
        openTooltip: (target, opts) =>
          Effect.gen(function* () {
            yield* closeCurrent;
            const scope = yield* Scope.make();
            const handle = yield* openSession({ deps, target, opts, resolveAsset, scope }).pipe(
              Scope.extend(scope),
            );
            if (handle === null) return yield* Scope.close(scope, Exit.void);
            current = handle;
          }),
        close: closeCurrent,
        hide: Effect.sync(() => current?.setHidden(true)),
        show: Effect.sync(() => current?.setHidden(false)),
      };
    }),
  );

export const TooltipPortLive = makeTooltipPortLive();
