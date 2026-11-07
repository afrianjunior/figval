import { Effect, Exit, Fiber, Layer, Runtime, Scope, type Context } from 'effect';
import {
  directionOf,
  Messenger,
  MessengerLive,
  type ContentRequest,
  type Handler,
  type Request,
} from '../messaging';
import {
  ChromeStorageLive,
  NoteRepoLive,
  SessionRepoLive,
  SessionStore,
  SessionStoreLive,
  SettingsRepoLive,
} from '../storage';
import { makeEditRegistry, watchReapply, type EditRegistry } from './edit';
import { makeTooltipPortLive } from './tooltip';
import { makeMarkerLayer, type MarkerLayer } from './markers';
import {
  acquireOverlayHost,
  startPicker,
  startSelection,
  TooltipPort,
  type OverlayHost,
} from './picker';

export const CONTENT_FLAG = '__figvalContent';

export interface ContentOptions {
  readonly doc?: Document;
  /** Maps an emitted asset path to a loadable URL (`browser.runtime.getURL` in the entrypoint). */
  readonly resolveAsset: (path: string) => string;
}

export interface ContentApp {
  readonly handle: Handler;
  readonly registry: EditRegistry;
  readonly host: OverlayHost;
  readonly markers: MarkerLayer;
}

type Deps = {
  readonly doc: Document;
  readonly host: OverlayHost;
  readonly registry: EditRegistry;
  readonly markers: MarkerLayer;
  readonly port: Context.Tag.Service<typeof TooltipPort>;
};

const makePickerController = (deps: Deps, appScope: Scope.Scope) =>
  Effect.gen(function* () {
    const run = Runtime.runFork(yield* Effect.runtime<never>());
    let active: Scope.CloseableScope | null = null;
    let selectionOn = false;

    const stop = Effect.suspend(() => {
      const scope = active;
      active = null;
      return scope ? Scope.close(scope, Exit.void) : Effect.void;
    });
    const withPort = Effect.provideService(TooltipPort, deps.port);

    const startSelectionOnce = Effect.suspend(() => {
      if (selectionOn) return Effect.void;
      selectionOn = true;
      return startSelection(deps).pipe(withPort, Scope.extend(appScope));
    });
    const start = Effect.gen(function* () {
      yield* stop;
      yield* startSelectionOnce;
      const scope = yield* Scope.make();
      active = scope;
      yield* startPicker({ ...deps, onFinish: () => run(stop) }).pipe(
        withPort,
        Scope.extend(scope),
      );
    });
    return { start, stop };
  });

const route =
  (deps: Deps, picker: { start: Effect.Effect<void>; stop: Effect.Effect<void> }) =>
  (req: ContentRequest): Effect.Effect<unknown> => {
    const { host, registry, markers, port } = deps;
    switch (req._tag) {
      case 'Ping':
        return Effect.succeed({ pong: true });
      case 'PickerStart':
        return picker.start;
      case 'PickerStop':
        return picker.stop;
      case 'UiHide':
        return Effect.suspend(() => (host.setHidden(true), port.hide));
      case 'UiShow':
        return Effect.suspend(() => (host.setHidden(false), port.show));
      case 'EditsOff':
        return Effect.sync(() => registry.editsOff());
      case 'EditsOn':
        return Effect.sync(() => registry.editsOn());
      case 'MarkersRender':
        return markers.render(req.notes, req.highlightId);
      case 'MarkersClear':
        return markers.clear;
      case 'Highlight':
        return markers.highlight(req.noteId);
      case 'ScrollTo':
        return markers.scrollTo(req.noteId);
      case 'TooltipReopen':
        return markers.reopen(req.noteId);
    }
  };

const isContent = (req: Request): req is ContentRequest => directionOf(req._tag) === 'toContent';

/** Builds the content-side graph and serves it for the lifetime of the surrounding scope. */
export const startContent = (
  options: ContentOptions,
): Effect.Effect<ContentApp, never, Scope.Scope | Messenger | SessionStore | TooltipPort> =>
  Effect.gen(function* () {
    const doc = options.doc ?? document;
    const messenger = yield* Messenger;
    const port = yield* TooltipPort;
    const appScope = yield* Effect.scope;
    const host = yield* acquireOverlayHost({ doc, resolveAsset: options.resolveAsset });
    const registry = makeEditRegistry(doc);
    yield* Effect.addFinalizer(() => Effect.sync(() => registry.release()));
    const markers = yield* makeMarkerLayer({ doc, host, registry });
    const deps: Deps = { doc, host, registry, markers, port };
    const picker = yield* makePickerController(deps, appScope);
    const dispatch = route(deps, picker);
    const handle: Handler = (req) => (isContent(req) ? dispatch(req) : Effect.void);

    yield* watchReapply(registry, doc, markers.elementOf);
    yield* messenger.serve('content', handle);
    yield* Effect.addFinalizer(() => picker.stop);
    return { handle, registry, host, markers };
  });

const makeContentLive = (options: ContentOptions) => {
  const repos = Layer.mergeAll(SettingsRepoLive, SessionRepoLive, NoteRepoLive).pipe(
    Layer.provide(ChromeStorageLive),
  );
  const base = Layer.mergeAll(MessengerLive, SessionStoreLive, repos);
  const tooltip = makeTooltipPortLive({ resolveAsset: options.resolveAsset }).pipe(
    Layer.provide(base),
  );
  return Layer.merge(base, tooltip);
};

/** Content script entry. Guarded so a second `executeScript` injection does nothing. */
export function main(options: ContentOptions, onInvalidated?: (cb: () => void) => void): void {
  const flags = globalThis as unknown as Record<string, unknown>;
  if (flags[CONTENT_FLAG]) return;
  flags[CONTENT_FLAG] = true;
  const program = Effect.gen(function* () {
    yield* startContent(options);
    yield* Effect.never;
  }).pipe(Effect.scoped, Effect.provide(makeContentLive(options)));
  const fiber = Effect.runFork(program);
  onInvalidated?.(() => {
    flags[CONTENT_FLAG] = false;
    Effect.runFork(Fiber.interrupt(fiber));
  });
}
