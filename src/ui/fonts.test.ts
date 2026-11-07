import { describe, expect, it } from 'vitest';
import { buildFontFaceCss, fontFaces } from './fonts';

describe('buildFontFaceCss', () => {
  it('emits one swap face per font file using the resolver', () => {
    const css = buildFontFaceCss((p) => `chrome-extension://id/${p}`);
    expect(css.match(/@font-face/g)).toHaveLength(fontFaces.length);
    expect(css).toContain('font-display:swap');
    expect(css).toContain('chrome-extension://id/');
  });

  it('uses at most two families', () => {
    expect(new Set(fontFaces.map((f) => f.family)).size).toBe(2);
  });
});
