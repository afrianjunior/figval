import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';
import { makeNote, makeSession, NOW, noteId } from './__fixtures__/builders';
import { renderHuman, renderLlm } from './index';
import { styleTable } from './table';
import { fenceFor, fenced, isoDateTime } from './util';
import { hasShot } from './human-note';
import type { ExportInput } from './types';

const inputOf = (...notes: ReturnType<typeof makeNote>[]): ExportInput => ({
  session: makeSession(notes),
  notes,
  now: NOW,
});

const padding = [
  { property: 'padding-inline' as const, before: '4px', after: '8px' },
  { property: 'color' as const, before: '#000', after: '#fff' },
  { property: 'padding-block' as const, before: '1px', after: '2px' },
];

describe('renderHuman', () => {
  it('merges both padding changes at the first padding slot', () => {
    const out = renderHuman(inputOf(makeNote({ seq: 1, edits: { style: padding } })));
    expect(out).toContain(
      '- Vertical padding from 1px to 2px, horizontal from 4px to 8px\n- Text color from `#000` to `#fff`',
    );
  });

  it('keeps a lone padding change on its own line', () => {
    const out = renderHuman(inputOf(makeNote({ seq: 1, edits: { style: [padding[0]!] } })));
    expect(out).toContain('- Horizontal padding from 4px to 8px');
  });

  it('shows the scope line only for similar notes with changes', () => {
    const similar = makeNote({
      seq: 1,
      edits: { hidden: true, scope: 'similar', similarSelector: '.a', similarCount: 5 },
    });
    expect(renderHuman(inputOf(similar))).toContain('- Applies to **all similar elements** (5)');
    const commentOnly = makeNote({
      seq: 1,
      comment: 'x',
      edits: { scope: 'similar', similarCount: 5 },
    });
    expect(renderHuman(inputOf(commentOnly))).not.toContain('Applies to');
    expect(renderHuman(inputOf(commentOnly))).not.toContain('**Changes:**');
  });

  it('renders why and comment as separate notes', () => {
    const out = renderHuman(inputOf(makeNote({ seq: 1, why: 'because', comment: 'also' })));
    expect(out).toContain('**Note:** because\n\n**Note:** also');
  });

  it('omits the summary section when no note has a tag', () => {
    const out = renderHuman(inputOf(makeNote({ seq: 1, forceApply: true })));
    expect(out).not.toContain('## Summary');
  });

  it('numbers notes 1..n across pages in export order', () => {
    const out = renderHuman(
      inputOf(
        makeNote({ seq: 7, url: 'https://example.com/a', title: '' }),
        makeNote({ seq: 8, url: 'https://example.com/b', title: 'B' }),
        makeNote({ seq: 9, url: 'https://example.com/a', title: '' }),
      ),
    );
    expect(out).toContain('## example.com (`/a`)');
    expect(out.indexOf('### 1.')).toBeLessThan(out.indexOf('### 2.'));
    expect(out).toContain('### 3. Element');
    expect(out.indexOf('ID: FV-9')).toBeLessThan(out.indexOf('ID: FV-8'));
  });

  it('points to a screenshot per the lookup: set, predicate, or stored ids', () => {
    const a = makeNote({ seq: 1 });
    const b = makeNote({ seq: 2, shotted: true });
    const base = inputOf(a, b);
    const hint = '_Screenshot available in Figval';
    expect(renderHuman(base)).toContain(`${hint}: FV-2_`);
    expect(renderHuman(base)).not.toContain(`${hint}: FV-1_`);
    expect(renderHuman({ ...base, shots: new Set([a.id]) })).toContain(`${hint}: FV-1_`);
    expect(renderHuman({ ...base, shots: new Set([a.id]) })).not.toContain(`${hint}: FV-2_`);
    expect(renderHuman({ ...base, shots: (n) => n.seq === 2 })).toContain(`${hint}: FV-2_`);
    expect(hasShot(a, new Set([noteId(1)]))).toBe(true);
  });

  it('handles an empty export', () => {
    const out = renderHuman(inputOf());
    expect(out).toContain('**Notes:** 0');
    expect(out).not.toContain('Screen size');
  });

  it('skips empty technical fields', () => {
    const out = renderHuman(inputOf(makeNote({ seq: 1 })));
    expect(out).toContain('- ID: FV-1\n</details>');
  });
});

describe('renderLlm', () => {
  it('uses singular counts for one change on one page', () => {
    expect(renderLlm(inputOf(makeNote({ seq: 1 })))).toContain('· 1 change · 1 page\n');
  });

  it('prints Comment alone for comment-only notes and Why for edited comment notes', () => {
    const commentOnly = renderLlm(inputOf(makeNote({ seq: 1, comment: 'c' })));
    expect(commentOnly).toContain('**Comment:** c');
    expect(commentOnly).not.toContain('**Why:**');
    const edited = renderLlm(inputOf(makeNote({ seq: 1, comment: 'c', edits: { hidden: true } })));
    expect(edited).toContain('**Why:** c');
    expect(edited).not.toContain('**Comment:**');
  });

  it('prints Why and Comment together when both exist with edits', () => {
    const out = renderLlm(
      inputOf(makeNote({ seq: 1, why: 'w', comment: 'c', edits: { hidden: true } })),
    );
    expect(out).toContain('**Why:** w\n\n**Comment:** c');
  });

  it('prints no tag cell when a force-applied note has nothing else', () => {
    expect(renderLlm(inputOf(makeNote({ seq: 1, forceApply: true })))).toContain(
      '### FV-1 · Element\nscope: **this element** · intent: **apply** · state: rest',
    );
  });

  it('renders step ids, test ids and nth in the DOM path', () => {
    const note = makeNote({
      seq: 1,
      target: {
        domPath: [
          { tag: 'main', classes: [] },
          { tag: 'li', id: 'x', classes: ['a', 'b'], testid: 't', nth: 2 },
        ],
      },
    });
    expect(renderLlm(inputOf(note))).toContain(
      '  main\n    → li#x.a.b[data-testid="t"]:nth-of-type(2)',
    );
  });

  it('wraps HTML containing backtick runs in a longer fence', () => {
    const note = makeNote({ seq: 1, target: { html: '<code>```</code>' } });
    expect(renderLlm(inputOf(note))).toContain('````html\n<code>```</code>\n````');
  });

  it('swaps the session id into the return format', () => {
    const out = renderLlm(inputOf(makeNote({ seq: 1 })));
    expect(out).toContain('## Figval Report — session fv-7k2q');
    expect(out.endsWith('`proposed`\n')).toBe(true);
  });

  it('handles an empty export', () => {
    expect(renderLlm(inputOf())).toContain('· 0 changes · 0 pages');
  });

  it('falls back to the host when the page has no title', () => {
    expect(renderLlm(inputOf(makeNote({ seq: 1, title: '' })))).toContain(
      '## Page: `/` — example.com · viewport 1440×900',
    );
  });
});

describe('helpers', () => {
  it('builds an unpadded table and escapes pipes', () => {
    expect(styleTable([{ property: 'color', before: 'a|b', after: 'c' }])).toEqual([
      '| Property | Before | After |',
      '|---|---|---|',
      '| color | `a\\|b` | `c` |',
    ]);
  });

  it('computes fences and UTC timestamps', () => {
    expect(fenceFor('plain')).toBe('```');
    expect(fenced('ts', 'a')).toEqual(['```ts', 'a', '```']);
    expect(isoDateTime(Date.UTC(2026, 0, 2, 3, 4))).toBe('2026-01-02 03:04');
    expect(Schema.is(Schema.String)(noteId(1))).toBe(true);
  });
});
