import { describe, expect, it } from 'vitest';
import { place, type Box } from './position';

const viewport = { w: 1000, h: 800 };
const size = { w: 300, h: 400 };
const at = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });

describe('place', () => {
  it('prefers the right side', () => {
    const r = place({ anchor: at(100, 100, 200, 40), size, viewport });
    expect(r.side).toBe('right');
    expect(r.x).toBe(312);
    expect(r.y).toBe(100);
  });

  it('falls back to the left when right is full', () => {
    const r = place({ anchor: at(650, 100, 300, 40), size, viewport });
    expect(r.side).toBe('left');
    expect(r.x).toBe(650 - 12 - 300);
  });

  it('falls back below when neither side fits', () => {
    const r = place({ anchor: at(100, 50, 780, 60), size, viewport });
    expect(r.side).toBe('below');
    expect(r.y).toBe(50 + 60 + 12);
  });

  it('falls back above when below is full', () => {
    const r = place({ anchor: at(100, 500, 780, 60), size: { w: 300, h: 400 }, viewport });
    expect(r.side).toBe('above');
    expect(r.y).toBe(500 - 12 - 400);
  });

  it('docks bottom-right when the element is near viewport size', () => {
    const r = place({ anchor: at(0, 0, 1000, 800), size, viewport });
    expect(r.side).toBe('dock');
    expect(r.x).toBe(1000 - 300 - 8);
    expect(r.y).toBe(800 - 400 - 8);
  });

  it('docks when nothing fits without covering', () => {
    const r = place({ anchor: at(100, 150, 780, 500), size, viewport });
    expect(r.side).toBe('dock');
  });

  it('never leaves the viewport', () => {
    const r = place({ anchor: at(100, 700, 100, 60), size, viewport });
    expect(r.y + size.h).toBeLessThanOrEqual(viewport.h - 8);
    expect(r.y).toBeGreaterThanOrEqual(8);
  });

  it('reports which way an off-screen element lies', () => {
    expect(place({ anchor: at(100, -300, 100, 50), size, viewport }).offscreen).toBe('above');
    expect(place({ anchor: at(100, 900, 100, 50), size, viewport }).offscreen).toBe('below');
    expect(place({ anchor: at(100, 100, 100, 50), size, viewport }).offscreen).toBeNull();
  });
});
