import { preview, revert } from '../edit';
import { diffOf } from './model/selectors';
import type { TooltipState } from './model/state';

export interface Previewer {
  /** Swaps the element after the page re-rendered it. */
  readonly setElement: (el: Element) => void;
  readonly apply: (state: TooltipState) => void;
  /** While true, text lives in the page element (contenteditable) and preview leaves it alone. */
  readonly setTextActive: (active: boolean) => void;
  readonly revertAll: () => void;
}

/** Live preview of the draft on the page; the edit engine keeps the original for exact revert. */
export const makePreviewer = (initial: Element, doc: Document): Previewer => {
  let el = initial;
  let textActive = false;

  const writeText = (state: TooltipState): void => {
    const text = state.controls.text ?? state.baseline.text;
    if (text !== null && el.textContent !== text) el.textContent = text;
  };

  return {
    setElement: (next) => {
      revert(el, doc);
      el = next;
    },
    setTextActive: (active) => {
      textActive = active;
    },
    apply: (state) => {
      if (state.elementStatus === 'gone') return revert(el, doc);
      if (textActive) return writeText(state);
      preview(el, diffOf(state), doc);
    },
    revertAll: () => revert(el, doc),
  };
};
