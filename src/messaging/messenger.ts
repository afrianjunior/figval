import { Context, Duration, Effect, Option, Schedule, Schema, type Scope } from 'effect';
import { MessageDecodeError, MessageTimeout, type TabId } from '../domain';
import { RemoteFailure } from './errors';
import {
  directionOf,
  replyEnvelope,
  replySchemaFor,
  Request,
  type BackgroundRequest,
  type ContentRequest,
  type Reply,
  type ReplyValue,
} from './protocol';
import type { SendTarget, Side, Transport } from './transport';

export type MessagingError = MessageTimeout | MessageDecodeError | RemoteFailure;

export interface CallOptions {
  readonly timeoutMs?: number;
  /** Extra attempts after a MessageTimeout (default 2). */
  readonly retries?: number;
}

export interface HandlerError {
  readonly _tag: string;
  readonly message?: unknown;
}
export type Handler = (req: Request) => Effect.Effect<unknown, HandlerError>;

export interface MessengerService {
  readonly toBackground: <R extends BackgroundRequest>(
    req: R,
    options?: CallOptions,
  ) => Effect.Effect<ReplyValue<R>, MessagingError>;
  readonly toContent: <R extends ContentRequest>(
    tabId: TabId,
    req: R,
    options?: CallOptions,
  ) => Effect.Effect<ReplyValue<R>, MessagingError>;
  readonly serve: (side: Side, handler: Handler) => Effect.Effect<void, never, Scope.Scope>;
}

export class Messenger extends Context.Tag('figval/Messenger')<Messenger, MessengerService>() {}

export interface MessengerConfig {
  readonly dev: boolean;
  readonly timeoutMs: number;
  readonly retries: number;
}

export const defaultMessengerConfig: MessengerConfig = { dev: false, timeoutMs: 5000, retries: 2 };

const decodeFailure = (type: string, issue: unknown): MessageDecodeError =>
  new MessageDecodeError({ type, issue: issue instanceof Error ? issue.message : String(issue) });

const tagOf = (raw: unknown): string =>
  typeof raw === 'object' && raw !== null && '_tag' in raw && typeof raw._tag === 'string'
    ? raw._tag
    : 'unknown';

const errorReply = (tag: string, message?: string): Reply<never> => ({
  ok: false,
  error: message === undefined ? { tag } : { tag, message },
});

const messageOf = (e: HandlerError): string | undefined =>
  typeof e.message === 'string' ? e.message : undefined;

export const makeMessenger = (transport: Transport, config: Partial<MessengerConfig> = {}): MessengerService => {
  const cfg: MessengerConfig = { ...defaultMessengerConfig, ...config };

  const send = (target: SendTarget, req: Request, raw: unknown, options?: CallOptions) => {
    const ms = options?.timeoutMs ?? cfg.timeoutMs;
    return Effect.suspend(() => transport.send(target, raw)).pipe(
      Effect.mapError(() => new MessageTimeout({ type: req._tag, ms: 0 })),
      Effect.timeoutFail({
        duration: Duration.millis(ms),
        onTimeout: () => new MessageTimeout({ type: req._tag, ms }),
      }),
      Effect.retry(Schedule.recurs(options?.retries ?? cfg.retries)),
    );
  };

  const call = (target: SendTarget, req: Request, options?: CallOptions) =>
    Effect.gen(function* () {
      const raw = yield* Schema.encode(Request)(req).pipe(Effect.mapError((e) => decodeFailure(req._tag, e)));
      const rawReply = yield* send(target, req, raw, options);
      const reply = yield* Schema.decodeUnknown(replyEnvelope(replySchemaFor(req._tag)))(rawReply).pipe(
        Effect.mapError((e) => decodeFailure(req._tag, e)),
      );
      if (!reply.ok) {
        return yield* Effect.fail(new RemoteFailure(reply.error));
      }
      return reply.value;
    }).pipe(
      Effect.catchTag('MessageDecodeError', (e) =>
        // divergent: dev dies loudly, prod logs and escapes (p.impl.md §6)
        cfg.dev
          ? Effect.die(e)
          : Effect.logWarning(`message decode failed: ${e.type}`).pipe(Effect.zipRight(Effect.fail(e))),
      ),
    );

  const runHandler = (handler: Handler, req: Request) =>
    Effect.gen(function* () {
      const value = yield* handler(req);
      const encoded = yield* Schema.encodeUnknown(replyEnvelope(replySchemaFor(req._tag)))({
        ok: true,
        value,
      }).pipe(Effect.mapError((e) => decodeFailure(req._tag, `reply: ${e.message}`)));
      return encoded as unknown;
    }).pipe(
      Effect.catchAll((e) => Effect.succeed<unknown>(errorReply(e._tag, messageOf(e)))),
      Effect.catchAllCause((cause) =>
        Effect.logError('handler defect', cause).pipe(
          Effect.as<unknown>(errorReply('InvariantViolation', 'handler defect')),
        ),
      ),
    );

  const handleRaw =
    (side: Side, handler: Handler) =>
    (raw: unknown, senderId: string | undefined): Effect.Effect<Option.Option<unknown>> => {
      if (senderId !== transport.extensionId) return Effect.succeed(Option.none());
      return Schema.decodeUnknown(Request)(raw).pipe(
        Effect.matchEffect({
          onFailure: (e) =>
            Effect.succeed<unknown>(errorReply('MessageDecodeError', `${tagOf(raw)}: ${e.message}`)),
          onSuccess: (req) =>
            (directionOf(req._tag) === 'toBackground') === (side === 'background')
              ? runHandler(handler, req)
              : Effect.succeed<unknown>(errorReply('MessageDecodeError', `${req._tag} not served by ${side}`)),
        }),
        Effect.map((reply) => Option.some(reply)),
      );
    };

  return {
    toBackground: (req, options) =>
      call({ side: 'background' }, req, options) as Effect.Effect<never, MessagingError>,
    toContent: (tabId, req, options) =>
      call({ side: 'content', tabId }, req, options) as Effect.Effect<never, MessagingError>,
    serve: (side, handler) => transport.listen(side, handleRaw(side, handler)),
  };
};
