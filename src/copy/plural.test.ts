import { describe, expect, it } from 'vitest';
import { plural } from './plural';

describe('plural', () => {
  it('uses the singular form for exactly one', () => {
    expect(plural(1, 'note', 'notes')).toBe('note');
  });

  it('uses the plural form for zero and for many', () => {
    expect(plural(0, 'note', 'notes')).toBe('notes');
    expect(plural(2, 'note', 'notes')).toBe('notes');
  });
});
