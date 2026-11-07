import { describe, expect, it } from 'vitest';
import { cropRegion } from './capture-math';
import { originPattern } from './permissions';
import { unsupportedUrl } from './unsupported-url';

describe('cropRegion (rect × dpr)', () => {
  const image = { width: 2880, height: 1800 };

  it('scales a CSS rect by the device pixel ratio', () => {
    expect(cropRegion({ x: 10, y: 20, w: 100, h: 50 }, 2, image)).toEqual({ sx: 20, sy: 40, sw: 200, sh: 100 });
  });

  it('rounds outward on fractional dpr', () => {
    expect(cropRegion({ x: 10.2, y: 10.2, w: 10, h: 10 }, 1.5, image)).toEqual({ sx: 15, sy: 15, sw: 16, sh: 16 });
  });

  it('clamps to the image bounds', () => {
    expect(cropRegion({ x: -10, y: -10, w: 5000, h: 5000 }, 1, image)).toEqual({ sx: 0, sy: 0, sw: 2880, sh: 1800 });
  });

  it('returns an empty region for a rect outside the image', () => {
    const region = cropRegion({ x: 5000, y: 5000, w: 10, h: 10 }, 1, image);
    expect(region.sw).toBe(0);
    expect(region.sh).toBe(0);
  });
});

describe('unsupportedUrl', () => {
  it.each([
    'chrome://extensions',
    'chrome-extension://abc/page.html',
    'chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/index.html',
    'https://chromewebstore.google.com/detail/x',
    'https://chrome.google.com/webstore/detail/x',
    'view-source:https://example.com',
    'devtools://devtools/bundled/inspector.html',
    'about:blank',
    'https://example.com/paper.PDF',
    'file:///tmp/a.pdf',
  ])('rejects %s', (url) => expect(unsupportedUrl(url)).toBe(true));

  it.each([
    'https://example.com/',
    'http://localhost:3000/app',
    'https://chrome.google.com/other',
    'https://example.com/pdf-guide',
    'file:///tmp/a.html',
    '',
    'not a url',
  ])('allows %s', (url) => expect(unsupportedUrl(url)).toBe(false));
});

describe('originPattern', () => {
  it('appends /* once', () => {
    expect(originPattern('https://a.com')).toBe('https://a.com/*');
    expect(originPattern('https://a.com/')).toBe('https://a.com/*');
  });
});
