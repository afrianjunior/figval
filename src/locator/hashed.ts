const GENERATED_PREFIX = /^(css|sc|jsx|emotion)-/;
// One opaque token of 6+ chars that contains a digit (e.g. "a1b2c3d4").
// Plain words such as "primary" or "container" stay stable.
const OPAQUE_TOKEN = /^(?=[a-z0-9]*\d)[a-z0-9]{6,}$/i;

/** True for generated (CSS-in-JS / bundler) class names that change per build. */
export function isHashedClass(name: string): boolean {
  return GENERATED_PREFIX.test(name) || OPAQUE_TOKEN.test(name);
}

/** The element's classes without generated ones, in source order. */
export function stableClasses(el: Element): readonly string[] {
  return Array.from(el.classList).filter((c) => !isHashedClass(c));
}
