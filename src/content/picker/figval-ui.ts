import { HOST_TAG } from './overlay-host';

/** Dispatched on the document when the "+ Note" action takes over from an active picker. */
export const PICKER_YIELD_EVENT = 'figval:picker-yield';

const HOST_ATTR = 'data-fv-host';

export const isFigvalHost = (node: EventTarget | null): boolean => {
  if (node === null || (node as Node).nodeType !== 1) return false;
  const el = node as Element;
  return el.localName === HOST_TAG || el.hasAttribute(HOST_ATTR);
};

/** True when the event originated in any Figval host (overlay or per-tooltip), shadow content included. */
export const isFigvalEvent = (event: Event): boolean =>
  isFigvalHost(event.target) || event.composedPath().some(isFigvalHost);
