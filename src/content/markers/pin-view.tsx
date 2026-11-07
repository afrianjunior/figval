import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { Pin, type PinProps } from '../../ui';

export interface PinView {
  readonly update: (props: PinProps) => void;
  readonly unmount: () => void;
}

/** Mounts the shared Pin primitive into a slot element; renders synchronously so positioning can follow. */
export const mountPin = (slot: HTMLElement, initial: PinProps): PinView => {
  const root = createRoot(slot);
  const render = (props: PinProps): void => flushSync(() => root.render(<Pin {...props} />));
  render(initial);
  return { update: render, unmount: () => root.unmount() };
};
