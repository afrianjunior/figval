import { Effect } from 'effect';
import { chromeApi } from './chrome-api';

/**
 * MV3 delivers the event that woke the service worker only to listeners added in its first tick.
 * The Live streams subscribe later (after awaits in `main`), so `primeEarlyEvents` runs first and
 * buffers what arrives meanwhile; each stream drains its slot when it subscribes.
 */
export type EarlyKind = 'action' | 'command' | 'install';

interface ChromeEvent<A> {
  readonly addListener: (listener: (arg: A) => void) => void;
  readonly removeListener: (listener: (arg: A) => void) => void;
}

interface Slot {
  readonly buffer: unknown[];
  readonly release: () => void;
}

const slots = new Map<EarlyKind, Slot>();

const hold = <A>(kind: EarlyKind, event: ChromeEvent<A>, onEvent: (arg: A) => void = () => undefined): void => {
  if (slots.has(kind)) return;
  const buffer: unknown[] = [];
  const listener = (arg: A) => {
    onEvent(arg);
    buffer.push(arg);
  };
  event.addListener(listener);
  slots.set(kind, { buffer, release: () => event.removeListener(listener) });
};

type ClickedTab = { readonly windowId?: number | undefined };

/** sidePanel.open needs the click's user gesture, so it runs inside the listener itself. */
export const openPanelFor = (tab: ClickedTab): void => {
  if (tab.windowId === undefined) return;
  chromeApi()
    .sidePanel.open({ windowId: tab.windowId })
    .catch((cause: unknown) => Effect.runFork(Effect.logWarning('sidePanel.open failed', cause)));
};

export const primeEarlyEvents = (): void => {
  const api = chromeApi();
  hold('action', api.action.onClicked as unknown as ChromeEvent<ClickedTab>, openPanelFor);
  hold('command', api.commands.onCommand as unknown as ChromeEvent<string>);
  hold('install', api.runtime.onInstalled as unknown as ChromeEvent<{ reason: string }>);
};

/** Stops buffering `kind` and returns what arrived before the stream subscribed (empty if never primed). */
export const takeEarly = <A>(kind: EarlyKind): readonly A[] => {
  const slot = slots.get(kind);
  if (slot === undefined) return [];
  slot.release();
  slots.delete(kind);
  return slot.buffer as A[];
};

/** Test-only: drop every early listener. */
export const resetEarlyEvents = (): void => {
  slots.forEach((slot) => slot.release());
  slots.clear();
};
