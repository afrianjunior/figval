import { describe, expect, it } from 'vitest';
import { clamp, nudgeValue, parseNumber, scrubValue, snap } from './scrub';

describe('scrub math', () => {
  it('scrubs by whole pixels times step', () => {
    expect(scrubValue(16, 5, 1, false, {})).toBe(21);
    expect(scrubValue(16, -3, 1, false, {})).toBe(13);
  });

  it('multiplies by ten with shift', () => {
    expect(scrubValue(16, 2, 1, true, {})).toBe(36);
  });

  it('clamps to min and max', () => {
    expect(scrubValue(4, -50, 1, false, { min: 0, max: 100 })).toBe(0);
    expect(scrubValue(90, 50, 1, false, { min: 0, max: 100 })).toBe(100);
    expect(clamp(5, { min: 6 })).toBe(6);
  });

  it('nudges with arrow semantics', () => {
    expect(nudgeValue(10, 1, 1, false, {})).toBe(11);
    expect(nudgeValue(10, -1, 1, true, {})).toBe(0);
  });

  it('avoids float drift for fractional steps', () => {
    expect(snap(0.1 + 0.2, 0.1)).toBe(0.3);
    expect(nudgeValue(0.1, 1, 0.1, false, {})).toBe(0.2);
  });

  it('parses typed numbers and rejects junk', () => {
    expect(parseNumber(' 12 ')).toBe(12);
    expect(parseNumber('1,5')).toBe(1.5);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
  });
});
