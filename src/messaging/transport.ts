import type { Effect, Option, Scope } from 'effect';
import type { TabId } from '../domain';

export type Side = 'background' | 'content';

export type SendTarget =
  | { readonly side: 'background' }
  | { readonly side: 'content'; readonly tabId: TabId };

/** Raw handler for one side: returns `None` when the message is ignored (no reply). */
export type RawHandler = (raw: unknown, senderId: string | undefined) => Effect.Effect<Option.Option<unknown>>;

/** Wire abstraction under the Messenger: chrome.runtime in production, in-process in tests. */
export interface Transport {
  readonly extensionId: string;
  readonly send: (target: SendTarget, raw: unknown) => Effect.Effect<unknown, unknown>;
  readonly listen: (side: Side, onRaw: RawHandler) => Effect.Effect<void, never, Scope.Scope>;
}
