import { Effect, Exit, Layer, Scope } from 'effect';
import { note as baseNote, noteId } from '../../messaging/fixtures';
import type { Edits, Note, Target } from '../../domain';
import { buildTarget } from '../../locator';
import { makeEditRegistry } from '../edit';
import { acquireOverlayHost, type OverlayHost } from './overlay-host';
import { TooltipPort, type TooltipOpenOptions } from './tooltip-port';

export interface PortCall {
  readonly target: Target;
  readonly opts: TooltipOpenOptions;
}

/** Recording TooltipPort test layer. */
export const recordingPort = () => {
  const calls: PortCall[] = [];
  const events: string[] = [];
  const layer = Layer.succeed(TooltipPort, {
    openTooltip: (target: Target, opts: TooltipOpenOptions) =>
      Effect.sync(() => void calls.push({ target, opts })),
    close: Effect.sync(() => void events.push('close')),
    hide: Effect.sync(() => void events.push('hide')),
    show: Effect.sync(() => void events.push('show')),
  });
  return { calls, events, layer };
};

export const noteFor = (el: Element, seq = 1, edits?: Edits): Note => ({
  ...baseNote,
  id: noteId(seq),
  seq: seq as Note['seq'],
  target: buildTarget(el),
  comment: `comment ${seq}`,
  ...(edits ? { edits } : {}),
});

export interface Harness {
  readonly scope: Scope.CloseableScope;
  readonly host: OverlayHost;
  readonly registry: ReturnType<typeof makeEditRegistry>;
  readonly close: () => void;
}

export const makeHarness = (doc: Document = document): Harness => {
  const scope = Effect.runSync(Scope.make());
  const host = Effect.runSync(
    acquireOverlayHost({ doc, resolveAsset: (p) => `chrome-extension://x${p}` }).pipe(
      Scope.extend(scope),
    ),
  );
  return {
    scope,
    host,
    registry: makeEditRegistry(doc),
    close: () => Effect.runSync(Scope.close(scope, Exit.void)),
  };
};

export const nextFrame = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => resolve()));
