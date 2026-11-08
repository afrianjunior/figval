import { Context, Effect, Layer, Stream } from 'effect';
import { chromeApi } from './chrome-api';
import { takeEarly } from './early-events';
import { TestDriver } from './test-driver';

export interface CommandsService {
  /** Keyboard command names (`pick`). */
  readonly onCommand: Stream.Stream<string>;
}

export class Commands extends Context.Tag('figval/platform/Commands')<Commands, CommandsService>() {}

export const CommandsLive: Layer.Layer<Commands> = Layer.succeed(Commands, {
  onCommand: Stream.asyncPush<string>((emit) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        const listener = (name: string) => void emit.single(name);
        chromeApi().commands.onCommand.addListener(listener);
        takeEarly<string>('command').forEach(listener);
        return listener;
      }),
      (listener) => Effect.sync(() => chromeApi().commands.onCommand.removeListener(listener)),
    ),
  ),
});

export const CommandsTest: Layer.Layer<Commands, never, TestDriver> = Layer.effect(
  Commands,
  Effect.map(TestDriver, (driver): CommandsService => ({ onCommand: Stream.fromPubSub(driver.commandEvents) })),
);
