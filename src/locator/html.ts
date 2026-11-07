const FIGVAL_ATTR = /^data-fv-/;
const ELLIPSIS = '…';

function stripMarkers(root: Element): void {
  for (const node of [root, ...Array.from(root.querySelectorAll('*'))]) {
    const marked = Array.from(node.attributes).some((a) => FIGVAL_ATTR.test(a.name));
    for (const attr of Array.from(node.attributes)) {
      if (FIGVAL_ATTR.test(attr.name)) node.removeAttribute(attr.name);
    }
    if (marked) node.removeAttribute('contenteditable');
  }
}

/** Open tag, collapsed text, close tag, never above max. */
function collapse(clone: Element, max: number): string {
  const shell = clone.cloneNode(false) as Element;
  const whole = shell.outerHTML;
  const close = `</${shell.tagName.toLowerCase()}>`;
  const hasClose = whole.endsWith(close);
  const open = hasClose ? whole.slice(0, -close.length) : whole;
  const tail = hasClose ? close : '';
  const budget = max - open.length - tail.length;
  if (budget < 0) return whole.slice(0, max);
  const text = (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
  if (!hasClose || text.length <= budget) return `${open}${hasClose ? text : ''}${tail}`;
  const kept = budget >= 1 ? `${text.slice(0, budget - 1)}${ELLIPSIS}` : '';
  return `${open}${kept}${tail}`;
}

/**
 * outerHTML capped at max chars. Long markup collapses to the opening tag,
 * trimmed text and the closing tag. Figval markers are stripped.
 */
export function trimHtml(el: Element, max: number): string {
  const clone = el.cloneNode(true) as Element;
  stripMarkers(clone);
  const full = clone.outerHTML;
  return full.length <= max ? full : collapse(clone, max);
}
