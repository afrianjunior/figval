import { Context, Effect, Layer, Option, Stream } from 'effect';
import { toTabInfo } from './tabs';
import { chromeApi } from './chrome-api';
import { TestDriver } from './test-driver';
import type { TabInfo } from './types';

export interface ActionService {
  /** Toolbar icon clicks, as the clicked tab (clicks on tabs without an id are dropped). */
  readonly onClicked: Stream.Stream<TabInfo>;
}

export class Action extends Context.Tag('figval/platform/Action')<Action, ActionService>() {}

export const ActionLive: Layer.Layer<Action> = Layer.succeed(Action, {
  onClicked: Stream.asyncPush<TabInfo>((emit) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        const listener = (tab: Parameters<typeof toTabInfo>[0]) => {
          Option.map(toTabInfo(tab), emit.single);
        };
        chromeApi().action.onClicked.addListener(listener);
        return listener;
      }),
      (listener) => Effect.sync(() => chromeApi().action.onClicked.removeListener(listener)),
    ),
  ),
});

export const ActionTest: Layer.Layer<Action, never, TestDriver> = Layer.effect(
  Action,
  Effect.map(TestDriver, (driver): ActionService => ({ onClicked: Stream.fromPubSub(driver.actionEvents) })),
);
