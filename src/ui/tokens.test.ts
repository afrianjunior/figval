import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/ui/tokens.css', 'utf8');

describe('tokens.css', () => {
  it('defines tokens on :root and :host', () => {
    expect(css).toMatch(/:root,\s*:host\s*{/);
  });

  it('has a dark scheme and a reduced-motion override', () => {
    expect(css).toContain('prefers-color-scheme: dark');
    expect(css).toContain('prefers-reduced-motion: reduce');
  });

  it.each([
    '--c-accent',
    '--c-apply',
    '--c-propose',
    '--c-missing',
    '--c-changed',
    '--c-surface-sunken',
    '--radius-panel',
    '--radius-control',
  ])('declares %s', (token) => {
    expect(css).toContain(`${token}:`);
  });
});
