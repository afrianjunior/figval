import { Effect, Exit, Layer, Option } from 'effect';
import { chromeApi } from '../platform/chrome-api';
import { Messenger, makeMessenger } from './messenger';
import type { RawHandler, SendTarget, Side, Transport } from './transport';

const send = (target: SendTarget, raw: unknown): Effect.Effect<unknown, unknown> =>
  Effect.tryPromise(() =>
    target.side === 'background'
      ? chromeApi().runtime.sendMessage(raw)
      : chromeApi().tabs.sendMessage(target.tabId, raw),
  );

const INVARIANT_REPLY = { ok: false, error: { tag: 'InvariantViolation' } } as const;

const listen = (_side: Side, onRaw: RawHandler) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const listener = (
        message: unknown,
        sender: { readonly id?: string | undefined; readonly tab?: { readonly id?: number | undefined } | undefined },
        sendResponse: (response?: unknown) => void,
      ): boolean => {
        if (sender.id !== chromeApi().runtime.id) return false;
        void Effect.runPromiseExit(onRaw(message, sender.id, sender.tab?.id)).then((exit) =>
          sendResponse(Exit.isSuccess(exit) ? Option.getOrUndefined(exit.value) : INVARIANT_REPLY),
        );
        return true;
      };
      chromeApi().runtime.onMessage.addListener(listener);
      return listener;
    }),
    (listener) => Effect.sync(() => chromeApi().runtime.onMessage.removeListener(listener)),
  );

export const chromeTransport = (): Transport => ({
  get extensionId() {
    return chromeApi().runtime.id;
  },
  send,
  listen,
});

export const MessengerLive: Layer.Layer<Messenger> = Layer.sync(Messenger, () =>
  makeMessenger(chromeTransport(), { dev: import.meta.env.DEV === true }),
);
