import { Effect, Fiber, Stream } from 'effect';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Action, ActionLive } from './action';
import { Commands, CommandsLive } from './commands';
import { primeEarlyEvents, resetEarlyEvents } from './early-events';
import { Extension, ExtensionLive } from './extension';
import { installFakeChrome, makeFakeChrome, uninstallFakeChrome, type FakeChrome } from './fake-chrome';

const settle = Effect.repeatN(Effect.yieldNow(), 10);
let fake: FakeChrome;

beforeEach(() => {
  fake = makeFakeChrome();
  installFakeChrome(fake);
});
afterEach(() => {
  resetEarlyEvents();
  uninstallFakeChrome();
});

const firstOf = <A, R>(stream: Effect.Effect<Stream.Stream<A>, never, R>, n: number, after: () => void) =>
  Effect.gen(function* () {
    const fiber = yield* Effect.fork(Stream.runCollect(Stream.take(Stream.unwrap(stream), n)));
    yield* settle;
    after();
    return Array.from(yield* Fiber.join(fiber));
  });

describe('early events (MV3 first-tick listeners)', () => {
  it('replays an install that fired before the stream subscribed, then hands over', async () => {
    primeEarlyEvents();
    fake.runtime.onInstalled.emit({ reason: 'install' });
    const reasons = await Effect.runPromise(
      Effect.provide(
        firstOf(Effect.map(Extension, (e) => e.onInstalled), 2, () => fake.runtime.onInstalled.emit({ reason: 'update' })),
        ExtensionLive,
      ),
    );
    expect(reasons).toEqual(['install', 'update']);
    expect(fake.runtime.onInstalled.listeners.size).toBe(0);
  });

  it('opens the side panel inside an early toolbar click and replays the click once', async () => {
    primeEarlyEvents();
    fake.action.onClicked.emit({ id: 3, url: 'https://a.test/', windowId: 9 });
    expect(fake.sidePanel.open).toHaveBeenCalledTimes(1);
    const tabs = await Effect.runPromise(
      Effect.provide(firstOf(Effect.map(Action, (a) => a.onClicked), 1, () => undefined), ActionLive),
    );
    expect(tabs).toEqual([{ id: 3, url: 'https://a.test/', title: '', windowId: 9 }]);
    expect(fake.sidePanel.open).toHaveBeenCalledTimes(1);
  });

  it('replays an early keyboard command', async () => {
    primeEarlyEvents();
    fake.commands.onCommand.emit('pick');
    const names = await Effect.runPromise(
      Effect.provide(firstOf(Effect.map(Commands, (c) => c.onCommand), 1, () => undefined), CommandsLive),
    );
    expect(names).toEqual(['pick']);
    expect(fake.commands.onCommand.listeners.size).toBe(0);
  });

  it('priming twice keeps a single early listener', () => {
    primeEarlyEvents();
    primeEarlyEvents();
    expect(fake.runtime.onInstalled.listeners.size).toBe(1);
  });
});
