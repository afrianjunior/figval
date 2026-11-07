import { Effect, Option } from 'effect';
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { ShotId } from '../../domain';
import { ShotStore } from '../../storage';
import type { PanelStore } from '../model';

/** Width of an element, kept current with a ResizeObserver. 0 until measured. */
export const useContainerWidth = (ref: RefObject<HTMLElement | null>): number => {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const node = ref.current;
    if (node === null) return;
    const measure = () => setWidth(node.getBoundingClientRect().width);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return width;
};

interface Loaded {
  readonly id: ShotId;
  readonly url: string;
}

/** Object URL for a stored screenshot, or null while loading or when none exists. */
export const useShotUrl = (store: PanelStore, shotId: ShotId | null): string | null => {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    if (shotId === null) return;
    let alive = true;
    let made: string | null = null;
    store
      .run(Effect.flatMap(ShotStore, (shots) => shots.get(shotId)))
      .then((blob) => {
        if (!alive || Option.isNone(blob) || typeof URL.createObjectURL !== 'function') return;
        made = URL.createObjectURL(blob.value);
        setLoaded({ id: shotId, url: made });
      })
      // A failed read leaves the designed "No screenshot" placeholder in place.
      .catch(() => undefined);
    return () => {
      alive = false;
      if (made !== null) URL.revokeObjectURL(made);
    };
  }, [store, shotId]);
  return shotId !== null && loaded?.id === shotId ? loaded.url : null;
};

/** Ref for a drill-in heading: focus lands on it when the screen opens. */
export const useHeadingFocus = <T extends HTMLElement>(): RefObject<T | null> => {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return ref;
};

export const FOCUS_KEY = 'data-focus-key';

/** Records which control opened a drill-in, and returns focus to it when the list is back. */
export const useFocusReturn = (drilledIn: boolean, root: RefObject<HTMLElement | null>) => {
  const origin = useRef<string | null>(null);
  const was = useRef(drilledIn);
  useEffect(() => {
    if (was.current && !drilledIn) {
      const key = origin.current;
      const target =
        key === null ? null : root.current?.querySelector<HTMLElement>(`[${FOCUS_KEY}="${key}"]`);
      const focusable = target?.matches('button,input,select,textarea,a[href]')
        ? target
        : target?.querySelector<HTMLElement>('button,input,select,textarea,a[href]');
      focusable?.focus();
    }
    was.current = drilledIn;
  }, [drilledIn, root]);
  return (event: { readonly target: EventTarget }) => {
    if (drilledIn || !(event.target instanceof Element)) return;
    const key = event.target.closest(`[${FOCUS_KEY}]`)?.getAttribute(FOCUS_KEY);
    if (key) origin.current = key;
  };
};

export const isMac = (): boolean => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);
export const searchHint = (hints: { readonly mac: string; readonly other: string }): string =>
  isMac() ? hints.mac : hints.other;
