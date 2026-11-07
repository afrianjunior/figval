import { Context, Effect, Layer } from 'effect';

export interface ClockService {
  readonly now: Effect.Effect<number>;
}

export class Clock extends Context.Tag('figval/platform/Clock')<Clock, ClockService>() {}

export const ClockLive: Layer.Layer<Clock> = Layer.succeed(Clock, { now: Effect.sync(() => Date.now()) });

export const ClockFixed = (ms: number): Layer.Layer<Clock> => Layer.succeed(Clock, { now: Effect.succeed(ms) });
