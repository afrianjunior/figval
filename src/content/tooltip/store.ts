import { reduce, type Action, type TooltipState } from './model/state';

export type Listener = (prev: TooltipState, next: TooltipState) => void;

export interface Store {
  readonly get: () => TooltipState;
  readonly dispatch: (action: Action) => void;
  readonly subscribe: (listener: Listener) => () => void;
}

/** Holds the one current tooltip state; every change goes through the pure reducer. */
export const makeStore = (initial: TooltipState): Store => {
  let state = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => state,
    dispatch: (action) => {
      const prev = state;
      state = reduce(prev, action);
      listeners.forEach((listener) => listener(prev, state));
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
};
