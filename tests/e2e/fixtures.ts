import {
  test as base,
  chromium,
  expect,
  type BrowserContext,
  type Page,
  type Worker,
} from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { copy } from '../../src/copy';

interface ChromeTab {
  readonly id?: number;
  readonly url?: string;
}

/** Extension-side API, only referenced inside functions evaluated in the service worker. */
declare const chrome: {
  readonly tabs: { readonly query: (q: { url?: string }) => Promise<ChromeTab[]> };
  readonly storage: {
    readonly local: { readonly get: (k: null) => Promise<Record<string, unknown>> };
  };
};

export const queryTabs = (worker: Worker, url?: string): Promise<number> =>
  worker.evaluate(async (u) => {
    const tabs = await chrome.tabs.query(u === undefined ? {} : { url: u });
    return tabs[0]?.id ?? -1;
  }, url);

const EXTENSION_PATH = resolve(import.meta.dirname, '../../.output/chrome-mv3-test');
const ORIGIN = 'http://127.0.0.1:4173';

export interface OpenedFixture {
  readonly page: Page;
  readonly tabId: number;
}

export interface Harness {
  readonly extensionId: string;
  readonly serviceWorker: Worker;
  readonly openFixture: (name: string, origin?: string) => Promise<OpenedFixture>;
  readonly openPanel: (tabId: number, width?: number) => Promise<Page>;
  readonly readClipboard: (panel: Page) => Promise<string>;
  readonly storage: () => Promise<Record<string, unknown>>;
}

type Fixtures = { context: BrowserContext; harness: Harness };

const tabIdFor = async (serviceWorker: Worker, url: string): Promise<number> => {
  await expect.poll(() => queryTabs(serviceWorker, url), { timeout: 10_000 }).not.toBe(-1);
  return queryTabs(serviceWorker, url);
};

export const test = base.extend<Fixtures>({
  context: async ({}, provide) => {
    const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'figval-')), {
      channel: 'chromium',
      headless: true,
      args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
    });
    await provide(context);
    await context.close();
  },
  harness: async ({ context }, provide) => {
    const serviceWorker =
      context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const extensionId = new URL(serviceWorker.url()).host;
    const extOrigin = `chrome-extension://${extensionId}`;
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const harness: Harness = {
      extensionId,
      serviceWorker,
      openFixture: async (name, origin = ORIGIN) => {
        const page = await context.newPage();
        const url = `${origin}/${name}`;
        await page.goto(url);
        return { page, tabId: await tabIdFor(serviceWorker, url) };
      },
      openPanel: async (tabId, width = 420) => {
        const panel = await context.newPage();
        await panel.setViewportSize({ width, height: 800 });
        await panel.goto(`${extOrigin}/sidepanel.html?tab=${tabId}`);
        return panel;
      },
      readClipboard: (panel) => panel.evaluate(() => navigator.clipboard.readText()),
      storage: () => serviceWorker.evaluate(() => chrome.storage.local.get(null)),
    };
    await provide(harness);
  },
});

export { expect, copy };
