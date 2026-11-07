import { describe, expect, it } from 'vitest';
import { indexAtY, moveId, showsThumbnail, THUMB_MIN_WIDTH } from './reorder';

describe('moveId', () => {
  it('moves an item down without mutating the input', () => {
    const input = ['a', 'b', 'c'] as const;
    expect(moveId(input, 'a', 2)).toEqual(['b', 'c', 'a']);
    expect(input).toEqual(['a', 'b', 'c']);
  });

  it('moves an item up', () => {
    expect(moveId(['a', 'b', 'c'], 'c', 0)).toEqual(['c', 'a', 'b']);
  });

  it('clamps the target and ignores unknown ids', () => {
    expect(moveId(['a', 'b'], 'a', 9)).toEqual(['b', 'a']);
    expect(moveId(['a', 'b'], 'z', 0)).toEqual(['a', 'b']);
  });
});

describe('indexAtY', () => {
  const mids = [10, 30, 50];

  it('picks the nearest slot midpoint', () => {
    expect(indexAtY(mids, 0)).toBe(0);
    expect(indexAtY(mids, 34)).toBe(1);
    expect(indexAtY(mids, 400)).toBe(2);
  });

  it('breaks ties toward the earlier slot and handles no slots', () => {
    expect(indexAtY(mids, 20)).toBe(0);
    expect(indexAtY([], 5)).toBe(0);
  });
});

describe('showsThumbnail', () => {
  it('turns on at the 340 px threshold', () => {
    expect(THUMB_MIN_WIDTH).toBe(340);
    expect(showsThumbnail(339)).toBe(false);
    expect(showsThumbnail(340)).toBe(true);
  });
});
