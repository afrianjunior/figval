import type { TabId } from '../domain';

/** Per-tab activation state, chrome.storage.session. */
export const activationKey = (tabId: TabId): string => `activation:${tabId}`;

/** Ids of notes whose element was not found on the tab; runtime only, never persisted to local. */
export const missingKey = (tabId: TabId): string => `missing:${tabId}`;

export const originOf = (url: string): string => (URL.canParse(url) ? new URL(url).origin : '');
