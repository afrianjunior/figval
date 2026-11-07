const BLOCK_TAGS = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'body',
  'dd',
  'details',
  'div',
  'dl',
  'dt',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'summary',
  'table',
  'td',
  'th',
  'tr',
  'ul',
]);

const toElement = (node: Node): Element | null =>
  node.nodeType === 1 ? (node as Element) : node.parentElement;

/**
 * Nearest block-level container of a node (tag based, no layout APIs).
 * Used by the text-selection variant to pick the Edit-tab target.
 */
export function nearestBlock(node: Node): Element {
  let cur = toElement(node);
  while (cur) {
    if (BLOCK_TAGS.has(cur.tagName.toLowerCase())) return cur;
    cur = cur.parentElement;
  }
  const doc = node.ownerDocument ?? (node as Document);
  return doc.body ?? doc.documentElement;
}
