import type { WxtBrowser } from 'wxt/browser';

/**
 * The only door to the `chrome` global. Resolved lazily on every call so tests can install a fake
 * `globalThis.chrome` after import. Only Live layers call this.
 */
export const chromeApi = (): WxtBrowser => (globalThis as { chrome?: WxtBrowser }).chrome as WxtBrowser;
