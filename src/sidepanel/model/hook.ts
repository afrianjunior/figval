import { useSyncExternalStore } from 'react';
import type { PanelActions } from './actions';
import type { PanelSnapshot, PanelStore } from './store';

export interface UsePanelStore extends PanelSnapshot {
  readonly actions: PanelActions;
}

/** Subscribes a component to the store; the snapshot is stable until the model changes. */
export const usePanelStore = (store: PanelStore): UsePanelStore => {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return { ...snapshot, actions: store.actions };
};
