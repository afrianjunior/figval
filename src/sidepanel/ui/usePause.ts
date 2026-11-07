import { useCallback, useRef, type FocusEvent, type PointerEvent } from 'react';

export interface PauseHandlers {
  readonly onPointerEnter: (e: PointerEvent<HTMLElement>) => void;
  readonly onPointerLeave: (e: PointerEvent<HTMLElement>) => void;
  readonly onFocus: (e: FocusEvent<HTMLElement>) => void;
  readonly onBlur: (e: FocusEvent<HTMLElement>) => void;
}

/**
 * Hover and focus-within as one paused/resumed signal (WCAG 2.2.1): onPause fires when the
 * first of pointer or focus arrives, onResume when the last one has left.
 */
export function usePauseHandlers(onPause: () => void, onResume: () => void): PauseHandlers {
  const hovered = useRef(false);
  const focused = useRef(false);
  const sync = useCallback(
    (wasPaused: boolean) => {
      const paused = hovered.current || focused.current;
      if (paused && !wasPaused) onPause();
      if (!paused && wasPaused) onResume();
    },
    [onPause, onResume],
  );
  const set = useCallback(
    (flag: typeof hovered, value: boolean) => {
      const wasPaused = hovered.current || focused.current;
      flag.current = value;
      sync(wasPaused);
    },
    [sync],
  );
  return {
    onPointerEnter: () => set(hovered, true),
    onPointerLeave: () => set(hovered, false),
    onFocus: () => set(focused, true),
    onBlur: (e) => {
      if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
      set(focused, false);
    },
  };
}
