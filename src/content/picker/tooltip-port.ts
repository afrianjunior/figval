import { Context, Effect, Layer } from 'effect';
import type { NoteId, Target } from '../../domain';
import type { EditRegistry } from '../edit';

export interface TooltipOpenOptions {
  readonly mode: 'new' | 'reopen';
  readonly noteId?: NoteId;
  readonly anchor: Element;
  readonly selectionText?: string;
  readonly registry: EditRegistry;
}

/** Contract implemented by the tooltip UI (W4); picker and markers only depend on this port. */
export class TooltipPort extends Context.Tag('figval/TooltipPort')<
  TooltipPort,
  {
    readonly openTooltip: (target: Target, opts: TooltipOpenOptions) => Effect.Effect<void>;
    readonly close: Effect.Effect<void>;
    readonly hide: Effect.Effect<void>;
    readonly show: Effect.Effect<void>;
  }
>() {}

export const TooltipPortNoop: Layer.Layer<TooltipPort> = Layer.succeed(TooltipPort, {
  openTooltip: () => Effect.void,
  close: Effect.void,
  hide: Effect.void,
  show: Effect.void,
});
