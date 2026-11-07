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
