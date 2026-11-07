import { Effect, Scope, TestContext } from 'effect';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeFakeChrome, installFakeChrome, uninstallFakeChrome, type FakeChrome } from '../platform/fake-chrome';
import { draft, note, tabId } from './fixtures';
import { MessengerLive } from './live';
import { Messenger, type Handler } from './messenger';

const run = <A, E>(eff: Effect.Effect<A, E, Messenger | Scope.Scope>) =>
  Effect.runPromise(eff.pipe(Effect.scoped, Effect.provide(MessengerLive), Effect.provide(TestContext.TestContext)));

const handler: Handler = (req) => (req._tag === 'NoteCreate' ? Effect.succeed(note) : Effect.succeed({ pong: true }));

let fake: FakeChrome;
beforeEach(() => {
  fake = makeFakeChrome();
  installFakeChrome(fake);
});
afterEach(uninstallFakeChrome);

describe('MessengerLive', () => {
  it('sends to the background through chrome.runtime and decodes the reply', async () => {
    const reply = await run(
      Effect.gen(function* () {
        const m = yield* Messenger;
        yield* m.serve('background', handler);
        return yield* m.toBackground({ _tag: 'NoteCreate', draft });
      }),
    );
    expect(reply).toEqual(note);
    expect(fake.runtime.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('sends to content through chrome.tabs.sendMessage', async () => {
    const reply = await run(
      Effect.gen(function* () {
        const m = yield* Messenger;
        yield* m.serve('content', handler);
        return yield* m.toContent(tabId, { _tag: 'Ping' });
      }),
    );
    expect(reply).toEqual({ pong: true });
    expect(fake.tabs.sendMessage).toHaveBeenCalledWith(tabId, expect.objectContaining({ _tag: 'Ping' }));
  });

  it('removes the onMessage listener when the scope closes', async () => {
    await run(
      Effect.gen(function* () {
        const m = yield* Messenger;
        yield* m.serve('background', handler);
        expect(fake.runtime.onMessage.listeners.size).toBe(1);
      }),
    );
    expect(fake.runtime.onMessage.listeners.size).toBe(0);
  });

  it('does not answer senders from another extension', async () => {
    uninstallFakeChrome();
    fake = makeFakeChrome({ senderId: 'other-ext' });
    installFakeChrome(fake);
    const errTag = await run(
      Effect.gen(function* () {
        const m = yield* Messenger;
        yield* m.serve('background', handler);
        return yield* Effect.flip(m.toBackground({ _tag: 'MissingReport', ids: [] }, { retries: 0 }));
      }),
    );
    expect(errTag._tag).toBe('MessageTimeout');
  });
});
