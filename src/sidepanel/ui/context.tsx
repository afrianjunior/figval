import { createContext, useContext } from 'react';
import type { ModelState, PanelActions, PanelStore } from '../model';

export interface PanelContextValue {
  readonly store: PanelStore;
  readonly actions: PanelActions;
  readonly model: ModelState;
}

export const PanelContext = createContext<PanelContextValue | null>(null);

export const usePanel = (): PanelContextValue => {
  const value = useContext(PanelContext);
  if (value === null) throw new Error('usePanel must be used inside <App>');
  return value;
};
