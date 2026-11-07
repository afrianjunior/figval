import { describe, expect, it } from 'vitest';
import { copy, ERROR_TAGS } from './strings';

const collectStrings = (value: unknown, out: string[] = []): string[] => {
  if (typeof value === 'string') out.push(value);
  else if (typeof value === 'function') {
    const result: unknown = (value as (...a: unknown[]) => unknown)(
      ...Array.from({ length: value.length }, (_, i) => (i === 0 ? 2 : 'x')),
    );
    if (typeof result === 'string') out.push(result);
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((v) => collectStrings(v, out));
  }
  return out;
};

describe('copy', () => {
  it('has a non-empty user-facing line for every error tag', () => {
    for (const tag of ERROR_TAGS) {
      expect(copy.errors[tag].length).toBeGreaterThan(0);
    }
  });

  it('contains no error tag keys beyond the known list', () => {
    expect(Object.keys(copy.errors).sort()).toEqual([...ERROR_TAGS].sort());
  });

  it('never uses em or en dashes outside the spec-fixed title', () => {
    const all = collectStrings(copy).filter((s) => /[–—]/.test(s));
    expect(all).toEqual([]);
  });

  it('keeps keyboard hints as data', () => {
    expect(copy.keys.submit).toBe('⌘↵');
    expect(copy.keys.escape).toBe('Esc');
  });

  it('pluralizes counts', () => {
    expect(copy.panel.states.notActivated.strip(1)).toContain('1 note ');
    expect(copy.panel.states.notActivated.strip(3)).toContain('3 notes ');
    expect(copy.markdownHuman.summary.textChange(1)).toBe('1 text change');
    expect(copy.markdownHuman.summary.textChange(2)).toBe('2 text changes');
  });

  it('interpolates the search query in the empty results line', () => {
    expect(copy.panel.states.noResults.line('xyz')).toBe('No notes match "xyz"');
  });
});
