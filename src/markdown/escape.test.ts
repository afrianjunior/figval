import { describe, expect, it } from 'vitest';
import { collapse, escapeQuotes, inlineCode, oneLine, quoted } from './escape';

describe('oneLine', () => {
  it('collapses whitespace runs including newlines and trims', () => {
    expect(oneLine('  a\n\n### b\t c  ')).toBe('a ### b c');
  });

  it('leaves plain text untouched', () => {
    expect(oneLine('Mulai gratis')).toBe('Mulai gratis');
  });
});

describe('collapse', () => {
  it('keeps edge spaces so inline context stays byte-identical', () => {
    expect(collapse('already used by ')).toBe('already used by ');
    expect(collapse('a\nb')).toBe('a b');
  });
});

describe('escapeQuotes', () => {
  it('escapes double quotes and flattens newlines', () => {
    expect(escapeQuotes('say "hi"\nnow')).toBe('say \\"hi\\" now');
  });
});

describe('quoted', () => {
  it('wraps in quotes with inner quotes escaped on one line', () => {
    expect(quoted('a "b"\nc')).toBe('"a \\"b\\" c"');
    expect(quoted('plain')).toBe('"plain"');
  });
});

describe('inlineCode', () => {
  it('uses a single backtick for plain text', () => {
    expect(inlineCode('#0F62FE')).toBe('`#0F62FE`');
  });

  it('uses a fence longer than the longest inner backtick run', () => {
    expect(inlineCode('a`b``c')).toBe('```a`b``c```');
  });

  it('pads with a space when the text starts or ends with a backtick', () => {
    expect(inlineCode('`tick`')).toBe('`` `tick` ``');
    expect(inlineCode('x`')).toBe('`` x` ``');
  });

  it('flattens newlines so the span stays on one line', () => {
    expect(inlineCode('a\n### b')).toBe('`a ### b`');
  });
});
