export interface MatchHighlighter {
  readonly show: (selector: string) => void;
  readonly hide: () => void;
  /** Re-measures the boxes after scroll or layout changes. */
  readonly refresh: () => void;
}

const query = (doc: Document, selector: string): readonly Element[] => {
  try {
    return [...doc.querySelectorAll(selector)];
  } catch {
    return [];
  }
};

/** Outline boxes over every element the "All similar" scope would touch. Built with DOM APIs only. */
export const makeMatchHighlighter = (layer: HTMLElement, doc: Document): MatchHighlighter => {
  let boxes: readonly { readonly el: Element; readonly box: HTMLElement }[] = [];
  let selector: string | null = null;

  const place = (el: Element, box: HTMLElement): void => {
    const r = el.getBoundingClientRect();
    box.style.transform = `translate(${r.left}px, ${r.top}px)`;
    box.style.width = `${r.width}px`;
    box.style.height = `${r.height}px`;
  };

  const hide = (): void => {
    boxes.forEach(({ box }) => box.remove());
    boxes = [];
    selector = null;
  };

  const show = (next: string): void => {
    hide();
    selector = next;
    boxes = query(doc, next).map((el) => {
      const box = doc.createElement('div');
      box.className = 'fv-tip-match';
      box.setAttribute('data-fv-match', '');
      layer.append(box);
      place(el, box);
      return { el, box };
    });
  };

  return {
    show,
    hide,
    refresh: () => {
      if (selector !== null) boxes.forEach(({ el, box }) => place(el, box));
    },
  };
};
