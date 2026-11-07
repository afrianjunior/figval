import { describe, expect, it } from 'vitest';
import { makeNote } from './__fixtures__/builders';
import { verifyLine } from './verify';

const style = [{ property: 'color' as const, before: '#000', after: '#fff' }];

describe('verifyLine', () => {
  it('lists text, style, scope and state clauses for an apply note', () => {
    const note = makeNote({
      seq: 1,
      edits: {
        text: { before: 'a', after: 'b' },
        style: [...style, { property: 'font-size', before: '1px', after: '2px' }],
        scope: 'similar',
        similarSelector: '.x',
        similarCount: 3,
      },
    });
    expect(verifyLine(note, '/p')).toBe(
      '**Verify:** On `/p`, the element reads "b" with color `#fff`, font-size `2px`; all 3 matching elements updated; hover/focus states still distinct.',
    );
  });

  it('omits the scope and style tail for a text-only edit on one element', () => {
    const note = makeNote({ seq: 1, edits: { text: { before: 'a', after: 'b' } } });
    expect(verifyLine(note, '/')).toBe('**Verify:** On `/`, the element reads "b".');
  });

  it('describes a style-only edit without a reads clause', () => {
    const note = makeNote({ seq: 1, edits: { style } });
    expect(verifyLine(note, '/')).toBe(
      '**Verify:** On `/`, the element with color `#fff`; hover/focus states still distinct.',
    );
  });

  it('reports removal for hidden elements and ignores other clauses', () => {
    const note = makeNote({
      seq: 1,
      edits: { hidden: true, style, text: { before: 'a', after: 'b' } },
    });
    expect(verifyLine(note, '/x')).toBe('**Verify:** On `/x`, the element is removed.');
  });

  it('keeps the scope clause for hidden similar elements', () => {
    const note = makeNote({
      seq: 1,
      edits: { hidden: true, scope: 'similar', similarSelector: '.x', similarCount: 2 },
    });
    expect(verifyLine(note, '/')).toBe(
      '**Verify:** On `/`, the element is removed; all 2 matching elements updated.',
    );
  });

  it('asks for a proposal when the note is not applied', () => {
    const note = makeNote({ seq: 1, comment: 'hm' });
    expect(verifyLine(note, '/')).toBe(
      '**Verify:** Reply with a proposed change for this element; do not edit code.',
    );
  });

  it('falls back to a neutral clause for force-applied notes without edits', () => {
    const note = makeNote({ seq: 1, comment: 'hm', forceApply: true });
    expect(verifyLine(note, '/')).toBe(
      '**Verify:** On `/`, the element matches the request above.',
    );
  });
});
