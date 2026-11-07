import { vi } from 'vitest';

/** Minimal event with the add/remove surface the Live layers use. Test-only. */
export const fakeEvent = <Args extends unknown[]>() => {
  const listeners = new Set<(...args: Args) => unknown>();
  return {
    listeners,
    addListener: (l: (...args: Args) => unknown) => void listeners.add(l),
    removeListener: (l: (...args: Args) => unknown) => void listeners.delete(l),
    emit: (...args: Args) => [...listeners].map((l) => l(...args)),
  };
};

type MessageListener = (message: unknown, sender: { id?: string }, respond: (r?: unknown) => void) => unknown;

/** Delivers a message to registered listeners like chrome messaging: resolves on respond. */
const dispatch = (event: ReturnType<typeof fakeEvent<[unknown, { id?: string }, (r?: unknown) => void]>>, senderId: string) =>
  (message: unknown): Promise<unknown> =>
    new Promise((resolve, reject) => {
      const kept = [...event.listeners].map((l) => (l as MessageListener)(message, { id: senderId }, resolve));
      if (!kept.some(Boolean)) reject(new Error('Could not establish connection. Receiving end does not exist.'));
    });

export interface FakeTab {
  id?: number;
  url?: string;
  title?: string;
  windowId: number;
  active?: boolean;
}

export const makeFakeChrome = (options: { id?: string; senderId?: string; tabs?: FakeTab[] } = {}) => {
  const id = options.id ?? 'ext-id';
  const senderId = options.senderId ?? id;
  const tabs = options.tabs ?? [];
  const onMessage = fakeEvent<[unknown, { id?: string }, (r?: unknown) => void]>();
  const deliver = dispatch(onMessage, senderId);
  const onActivated = fakeEvent<[{ tabId: number }]>();
  const onUpdated = fakeEvent<[number, { status?: string; url?: string }, FakeTab]>();
  const onRemoved = fakeEvent<[number]>();
  const onCommand = fakeEvent<[string]>();
  const onClicked = fakeEvent<[FakeTab]>();

  const api = {
    runtime: { id, onMessage, sendMessage: vi.fn(deliver) },
    tabs: {
      onActivated,
      onUpdated,
      onRemoved,
      sendMessage: vi.fn((_tabId: number, message: unknown) => deliver(message)),
      get: vi.fn((tabId: number) => {
        const tab = tabs.find((t) => t.id === tabId);
        return tab ? Promise.resolve(tab) : Promise.reject(new Error('No tab'));
      }),
      query: vi.fn<(q: unknown) => Promise<FakeTab[]>>(() => Promise.resolve(tabs.filter((t) => t.active))),
      captureVisibleTab: vi.fn<(w: number, o: unknown) => Promise<string>>(() => Promise.resolve('data:image/png;base64,AAAA')),
    },
    scripting: { executeScript: vi.fn<(o: unknown) => Promise<unknown[]>>(() => Promise.resolve([])) },
    permissions: {
      contains: vi.fn<(o: unknown) => Promise<boolean>>(() => Promise.resolve(false)),
      request: vi.fn<(o: unknown) => Promise<boolean>>(() => Promise.resolve(true)),
    },
    downloads: { download: vi.fn<(o: unknown) => Promise<number>>(() => Promise.resolve(1)) },
    sidePanel: {
      setPanelBehavior: vi.fn<(o: unknown) => Promise<void>>(() => Promise.resolve()),
      open: vi.fn<(o: unknown) => Promise<void>>(() => Promise.resolve()),
    },
    commands: { onCommand },
    action: { onClicked },
  };
  return api;
};

export type FakeChrome = ReturnType<typeof makeFakeChrome>;

export const installFakeChrome = (fake: FakeChrome): void => {
  (globalThis as { chrome?: unknown }).chrome = fake;
};

export const uninstallFakeChrome = (): void => {
  delete (globalThis as { chrome?: unknown }).chrome;
};
