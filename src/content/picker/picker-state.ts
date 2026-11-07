export interface PickerState {
  readonly current: Element | null;
  readonly selected: boolean;
  /** Elements stepped over by ArrowUp, so ArrowDown walks back down the same path. */
  readonly trail: readonly Element[];
}

export const initialPickerState: PickerState = { current: null, selected: false, trail: [] };

export const hover = (_state: PickerState, el: Element): PickerState => ({
  current: el,
  selected: false,
  trail: [],
});

export const up = (state: PickerState): PickerState => {
  const { current } = state;
  if (!current) return state;
  const parent = current.parentElement;
  if (!parent || parent === current.ownerDocument.documentElement)
    return { ...state, selected: true };
  return { current: parent, selected: true, trail: [...state.trail, current] };
};

export const down = (state: PickerState): PickerState => {
  const { current } = state;
  if (!current) return state;
  const back = state.trail.at(-1);
  if (back) return { current: back, selected: true, trail: state.trail.slice(0, -1) };
  const child = current.firstElementChild;
  return child ? { current: child, selected: true, trail: [] } : { ...state, selected: true };
};
