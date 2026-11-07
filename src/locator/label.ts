import { stableClasses } from './hashed';
import { clip, normalizeText } from './text';

const MAX_LABEL = 40;
const MAX_TEXT = 24;
const INPUT_TAGS = new Set(['input', 'textarea', 'select']);

const capitalize = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const shorten = (s: string, max: number): string =>
  s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;

function noun(el: Element): string | null {
  const tag = el.tagName.toLowerCase();
  const role = el.getAttribute('role');
  if (tag === 'button' || role === 'button') return 'button';
  if (tag === 'a' || role === 'link') return 'link';
  if (/^h[1-6]$/.test(tag) || role === 'heading') return 'heading';
  if (tag === 'img' || role === 'img') return 'image';
  if (INPUT_TAGS.has(tag)) return 'input';
  if (tag === 'label') return 'label';
  return null;
}

function humanizeClass(el: Element): string | null {
  const first = stableClasses(el)[0];
  if (!first) return null;
  const words = first.replace(/[-_]+/g, ' ').trim();
  return words ? capitalize(words) : null;
}

function ownText(el: Element, tag: string): string {
  if (tag === 'img') return normalizeText(el.getAttribute('alt'));
  if (INPUT_TAGS.has(tag)) {
    return normalizeText(
      el.getAttribute('placeholder') ?? el.getAttribute('name') ?? el.getAttribute('title'),
    );
  }
  return normalizeText(el.textContent);
}

/** Human label such as "Sign-up button", "Email label", "Promo banner". */
export function autoLabel(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const aria = normalizeText(el.getAttribute('aria-label'));
  if (aria) return clip(capitalize(aria), MAX_LABEL);

  const n = noun(el);
  if (n) {
    const text = ownText(el, tag) || humanizeClass(el)?.toLowerCase() || '';
    const budget = MAX_LABEL - n.length - 1;
    const lead = shorten(text, Math.min(MAX_TEXT, budget));
    return clip(capitalize(lead ? `${lead} ${n}` : n), MAX_LABEL);
  }
  const named = humanizeClass(el);
  if (named) return clip(named, MAX_LABEL);
  return clip(tag, MAX_LABEL);
}
