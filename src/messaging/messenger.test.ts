import { Effect, Exit, Fiber, Layer, Option, Scope, TestClock, TestContext, Cause } from 'effect';
import { describe, expect, it } from 'vitest';
import { ElementNotFound, MessageDecodeError, MessageTimeout, NoteSaveError } from '../domain';
import { RemoteFailure } from './errors';
import { draft, note, noteId, session, tabId } from './fixtures';
import { makeLoopbackTransport, makeMessengerLoopback, MessengerLoopback } from './loopback';
import { makeMessenger, Messenger, type Handler } from './messenger';
import type { Transport } from './transport';

const run = <A, E>(eff: Effect.Effect<A, E, Messenger | Scope.Scope>, layer: Layer.Layer<Messenger> = MessengerLoopback) =>
  Effect.runPromise(eff.pipe(Effect.scoped, Effect.provide(layer), Effect.provide(TestContext.TestContext)));

const echoNote: Handler = (req) => {
  switch (req._tag) {
    case 'NoteCreate':
      return Effect.succeed(note);
    case 'Ping':
      return Effect.succeed({ pong: true });
    default:
      return Effect.succeed(undefined);
  }
};

describe('Messenger over loopback', () => {
  it('sends a request to the background handler and decodes the reply', async () => {
    const reply = await run(
      Effect.gen(function* () {
        const m = yield* Messenger;
        yield* m.serve('background', echoNote);
        return yield* m.toBackground({ _tag: 'NoteCreate', draft });
      }),
    );
    expect(reply).toEqual(note);
  });

  it('sends a request to the content handler', async () => {
    const reply = await run(
      Effect.gen(function* () {
        const m = yield* Messenger;
        yield* m.serve('content', echoNote);
        const pong = yield* m.toContent(tabId, { _tag: 'Ping' });
        const nothing = yield* m.toContent(tabId, { _tag: 'UiHide' });
        return [pong, nothing] as const;
      }),
    );
    expect(reply).toEqual([{ pong: true }, undefined]);
  });

  it('passes the decoded request to the handler', async () => {
    const seen: unknown[] = [];
    await run(
      Effect.gen(function* () {
        const m = yield* Messenger;
        yield* m.serve('background', (req) => {
          seen.push(req);
          return Effect.succeed(session);
        });
        yield* m.toBackground({ _tag: 'SessionCreate', name: 'X' });
      }),
    );
    expect(seen).toEqual([{ _tag: 'SessionCreate', name: 'X' }]);
  });

  it('maps a handler failure to RemoteFailure with the remote tag', async () => {
    const err = await run(
      Effect.gen(function* () {
        const m = yield* Messenger;
        yield* m.serve('background', () => Effect.fail(new NoteSaveError({ reason: 'disk' })));
        return yield* Effect.flip(m.toBackground({ _tag: 'NoteDelete', id: noteId() }));
      }),
    );
    expect(err).toBeInstanceOf(RemoteFailure);
    expect(err).toMatchObject({ tag: 'NoteSaveError' });
  });

  it('keeps the tag of non-string-message errors', async () => {
    const err = await run(
      Effect.gen(function* () {
        const m = yield* Messenger;
        yield* m.serve('content', () => Effect.fail(new ElementNotFound({ noteId: noteId() })));
        return yield* Effect.flip(m.toContent(tabId, { _tag: 'ScrollTo', noteId: noteId() }));
      }),
    );
    expect(err).toMatchObject({ _tag: 'RemoteFailure', tag: 'ElementNotFound' });
  });

  it('turns a handler defect into an InvariantViolation reply', async () => {
    const err = await run(
      Effect.gen(function* () {
        const m = yield* Messenger;
        yield* m.serve('background', () => Effect.die('kaboom'));
        return yield* Effect.flip(m.toBackground({ _tag: 'NoteDelete', id: noteId() }));
      }),
    );
    expect(err).toMatchObject({ tag: 'InvariantViolation' });
  });

  it('replies MessageDecodeError when the handler returns a bad value', async () => {
    const err = await run(
      Effect.gen(function* () {
        const m = yield* Messenger;
        yield* m.serve('background', () => Effect.succeed({ nope: 1 }));
        return yield* Effect.flip(m.toBackground({ _tag: 'NoteCreate', draft }));
      }),
    );
    expect(err).toMatchObject({ _tag: 'RemoteFailure', tag: 'MessageDecodeError' });
  });

  it('unregisters the handler when the scope closes', async () => {
    const exit = await Effect.runPromise(
      Effect.gen(function* () {
        const m = yield* Messenger;
        const scope = yield* Scope.make();
        yield* Scope.extend(m.serve('background', echoNote), scope);
        yield* m.toBackground({ _tag: 'MissingReport', ids: [] });
        yield* Scope.close(scope, Exit.void);
        const fiber = yield* Effect.fork(
          Effect.flip(m.toBackground({ _tag: 'MissingReport', ids: [] }, { retries: 0, timeoutMs: 50 })),
        );
        yield* TestClock.adjust('50 millis');
        return yield* Fiber.join(fiber);
      }).pipe(Effect.provide(MessengerLoopback), Effect.provide(TestContext.TestContext)),
    );
    expect(exit).toBeInstanceOf(MessageTimeout);
  });

  it('ignores messages from a foreign sender (no reply, so the caller times out)', async () => {
    const layer = makeMessengerLoopback({ senderId: 'someone-else' });
    const err = await run(
      Effect.gen(function* () {
        const m = yield* Messenger;
        let called = false;
        yield* m.serve('background', () => {
          called = true;
          return Effect.succeed(undefined);
        });
        const fiber = yield* Effect.fork(
          Effect.flip(m.toBackground({ _tag: 'MissingReport', ids: [] }, { retries: 0, timeoutMs: 50 })),
        );
        yield* TestClock.adjust('50 millis');
        const result = yield* Fiber.join(fiber);
        expect(called).toBe(false);
        return result;
      }),
      layer,
    );
    expect(err).toBeInstanceOf(MessageTimeout);
  });

  it('ignores messages with no sender id', async () => {
    const layer = makeMessengerLoopback({ senderId: undefined });
    const err = await run(
      Effect.gen(function* () {
        const m = yield* Messenger;
        yield* m.serve('background', echoNote);
        const fiber = yield* Effect.fork(
          Effect.flip(m.toBackground({ _tag: 'MissingReport', ids: [] }, { retries: 0, timeoutMs: 10 })),
        );
        yield* TestClock.adjust('10 millis');
        return yield* Fiber.join(fiber);
      }),
      layer,
    );
    expect(err._tag).toBe('MessageTimeout');
  });
});

describe('Messenger server edge cases', () => {
  const rawSend = (raw: unknown, side: 'background' | 'content' = 'background') =>
    Effect.gen(function* () {
      const transport = makeLoopbackTransport();
      const m = makeMessenger(transport);
      yield* m.serve(side, echoNote);
      return yield* transport.send(side === 'background' ? { side } : { side, tabId }, raw);
    });

  it('replies MessageDecodeError for an undecodable request', async () => {
    const reply = await Effect.runPromise(Effect.scoped(rawSend({ _tag: 'Bogus' })));
    expect(reply).toMatchObject({ ok: false, error: { tag: 'MessageDecodeError' } });
  });

  it('replies MessageDecodeError for a non-object request', async () => {
    const reply = await Effect.runPromise(Effect.scoped(rawSend(42)));
    expect(reply).toMatchObject({ ok: false, error: { tag: 'MessageDecodeError', message: expect.stringContaining('unknown') } });
  });

  it('refuses a request that belongs to the other side', async () => {
    const reply = await Effect.runPromise(Effect.scoped(rawSend({ _tag: 'Ping' }, 'background')));
    expect(reply).toMatchObject({ ok: false, error: { tag: 'MessageDecodeError' } });
    const back = await Effect.runPromise(Effect.scoped(rawSend({ _tag: 'MissingReport', ids: [] }, 'content')));
    expect(back).toMatchObject({ ok: false, error: { tag: 'MessageDecodeError' } });
  });
});

describe('Messenger client edge cases', () => {
  const countingTransport = (replies: ReadonlyArray<Effect.Effect<unknown, unknown>>) => {
    const state = { sent: 0 };
    const transport: Transport = {
      extensionId: 'x',
      send: () => {
        const reply = replies[Math.min(state.sent, replies.length - 1)] ?? Effect.never;
        state.sent += 1;
        return reply;
      },
      listen: () => Effect.void,
    };
    return { state, transport };
  };

  const call = (m: ReturnType<typeof makeMessenger>) => Effect.flip(m.toBackground({ _tag: 'MissingReport', ids: [] }));

  it('retries a MessageTimeout twice (3 attempts) then escapes', async () => {
    const { state, transport } = countingTransport([Effect.never]);
    const m = makeMessenger(transport, { timeoutMs: 100 });
    const err = await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* Effect.fork(call(m));
        for (let i = 0; i < 3; i += 1) yield* TestClock.adjust('100 millis');
        return yield* Fiber.join(fiber);
      }).pipe(Effect.provide(TestContext.TestContext)),
    );
    expect(state.sent).toBe(3);
    expect(err).toMatchObject({ _tag: 'MessageTimeout', type: 'MissingReport', ms: 100 });
  });

  it('succeeds when a retry gets an answer', async () => {
    const { state, transport } = countingTransport([Effect.never, Effect.succeed({ ok: true, value: null })]);
    const m = makeMessenger(transport, { timeoutMs: 100 });
    const value = await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* Effect.fork(m.toBackground({ _tag: 'MissingReport', ids: [] }));
        yield* TestClock.adjust('100 millis');
        return yield* Fiber.join(fiber);
      }).pipe(Effect.provide(TestContext.TestContext)),
    );
    expect(value).toBeUndefined();
    expect(state.sent).toBe(2);
  });

  it('honours per-call retries', async () => {
    const { state, transport } = countingTransport([Effect.never]);
    const m = makeMessenger(transport);
    await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* Effect.fork(
          Effect.flip(m.toContent(tabId, { _tag: 'Ping' }, { retries: 0, timeoutMs: 300 })),
        );
        yield* TestClock.adjust('300 millis');
        yield* Fiber.join(fiber);
      }).pipe(Effect.provide(TestContext.TestContext)),
    );
    expect(state.sent).toBe(1);
  });

  it('treats a transport rejection as a retryable MessageTimeout', async () => {
    const { state, transport } = countingTransport([Effect.fail('no receiver')]);
    const err = await Effect.runPromise(call(makeMessenger(transport)).pipe(Effect.provide(TestContext.TestContext)));
    expect(state.sent).toBe(3);
    expect(err).toMatchObject({ _tag: 'MessageTimeout', ms: 0 });
  });

  it('escapes with MessageDecodeError in prod when the reply is garbage', async () => {
    const { transport } = countingTransport([Effect.succeed('garbage')]);
    const err = await Effect.runPromise(call(makeMessenger(transport, { dev: false })));
    expect(err).toBeInstanceOf(MessageDecodeError);
    expect(err).toMatchObject({ type: 'MissingReport' });
  });

  it('dies with MessageDecodeError in dev when the reply is garbage', async () => {
    const { transport } = countingTransport([Effect.succeed({ ok: true, value: 'not null' })]);
    const exit = await Effect.runPromiseExit(
      makeMessenger(transport, { dev: true }).toBackground({ _tag: 'MissingReport', ids: [] }),
    );
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const defect = Cause.dieOption(exit.cause);
      expect(Option.isSome(defect) && defect.value instanceof MessageDecodeError).toBe(true);
    }
  });

  it('rejects an invalid outgoing request with MessageDecodeError', async () => {
    const { state, transport } = countingTransport([Effect.succeed({ ok: true, value: null })]);
    const bad = { _tag: 'ScrollTo', noteId: 'nope' } as never;
    const err = await Effect.runPromise(Effect.flip(makeMessenger(transport).toContent(tabId, bad)));
    expect(err._tag).toBe('MessageDecodeError');
    expect(state.sent).toBe(0);
  });
});
