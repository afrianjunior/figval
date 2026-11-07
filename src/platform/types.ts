import type { TabId } from '../domain';

export interface TabInfo {
  readonly id: TabId;
  readonly url: string;
  readonly title: string;
  readonly windowId: number;
}

/** CSS-pixel rectangle relative to the viewport. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** One `chrome.tabs.onUpdated` change (any tab, not only the active one). */
export interface TabUpdate {
  readonly tabId: number;
  readonly status?: 'loading' | 'complete';
  readonly url?: string;
}
