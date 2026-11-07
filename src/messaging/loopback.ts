import { Effect, Layer, Option } from 'effect';
import { Messenger, makeMessenger, type MessengerConfig } from './messenger';
import type { RawHandler, SendTarget, Side, Transport } from './transport';

export interface LoopbackOptions {
  readonly extensionId?: string;
  /** Sender id attached to every message; defaults to `extensionId`. */
  readonly senderId?: string | undefined;
  /** Tab id attached to every message, simulating `sender.tab.id`; defaults to undefined. */
  readonly senderTabId?: number | undefined;
}

/** Structured-clone stand-in: only JSON-safe data crosses the boundary, as with chrome messaging. */
const wire = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

export const makeLoopbackTransport = (options: LoopbackOptions = {}): Transport => {
  const extensionId = options.extensionId ?? 'figval-test-extension';
  const senderId = 'senderId' in options ? options.senderId : extensionId;
  const handlers = new Map<Side, RawHandler>();

  const send = (target: SendTarget, raw: unknown): Effect.Effect<unknown> => {
    const handler = handlers.get(target.side);
    if (!handler) return Effect.never;
    return handler(wire(raw), senderId, options.senderTabId).pipe(
      Effect.flatMap(Option.match({ onNone: () => Effect.never, onSome: (reply) => Effect.succeed(wire(reply)) })),
    );
  };

  const listen = (side: Side, onRaw: RawHandler) =>
    Effect.acquireRelease(
      Effect.sync(() => void handlers.set(side, onRaw)),
      () => Effect.sync(() => void handlers.delete(side)),
    );

  return { extensionId, send, listen };
};

/** Loopback messenger: background and content handlers live in-process; schemas still run both ways. */
export const makeMessengerLoopback = (
  options: LoopbackOptions & Partial<MessengerConfig> = {},
): Layer.Layer<Messenger> =>
  Layer.sync(Messenger, () => makeMessenger(makeLoopbackTransport(options), options));

export const MessengerLoopback: Layer.Layer<Messenger> = makeMessengerLoopback();
