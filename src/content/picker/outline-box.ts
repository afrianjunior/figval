import { copy } from '../../copy';
import { stableClasses } from '../../locator';

export interface OutlineBox {
  readonly el: HTMLElement;
  readonly show: (target: Element, selected?: boolean) => void;
  readonly hide: () => void;
  readonly remove: () => void;
}

const CHIP_FLIP_TOP = 26;
const CORNERS = ['tl', 'tr', 'bl', 'br'] as const;

/** `tag.class` label for the picker chip. */
export const tagLabel = (el: Element): string => {
  const first = stableClasses(el)[0];
  const tag = el.tagName.toLowerCase();
  return first ? `${tag}.${first}` : tag;
};

const part = (doc: Document, className: string): HTMLElement => {
  const node = doc.createElement('div');
  node.className = className;
  return node;
};

/** Selection-blue outline that follows an element via transform; width/height only change on a fixed, out-of-flow box. */
export const createOutlineBox = (layer: HTMLElement, variant = ''): OutlineBox => {
  const doc = layer.ownerDocument;
  const el = part(doc, `fv-ov-box ${variant}`.trim());
  const chip = part(doc, 'fv-ov-chip fv-mono');
  el.append(...CORNERS.map((c) => part(doc, `fv-ov-corner fv-ov-corner--${c}`)), chip);
  el.hidden = true;
  layer.append(el);

  return {
    el,
    show: (target, selected = false) => {
      const rect = target.getBoundingClientRect();
      el.style.width = `${rect.width}px`;
      el.style.height = `${rect.height}px`;
      el.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
      el.classList.toggle('fv-ov-box--selected', selected);
      chip.classList.toggle('fv-ov-chip--below', rect.top < CHIP_FLIP_TOP);
      chip.textContent = copy.picker.labelChip(
        tagLabel(target),
        Math.round(rect.width),
        Math.round(rect.height),
      );
      el.hidden = false;
    },
    hide: () => {
      el.hidden = true;
    },
    remove: () => el.remove(),
  };
};
