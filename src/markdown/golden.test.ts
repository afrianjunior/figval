import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GOLDEN_CASES } from './__fixtures__/cases';
import { render, renderHuman, renderLlm } from './index';

const read = (name: string, ext: 'llm' | 'human'): string =>
  fs.readFileSync(path.join(__dirname, '__fixtures__', `${name}.${ext}.md`), 'utf8');

describe('golden exports', () => {
  it.each(GOLDEN_CASES)('$name renders the LLM golden byte for byte', ({ name, input }) => {
    expect(renderLlm(input)).toBe(read(name, 'llm'));
  });

  it.each(GOLDEN_CASES)('$name renders the human golden byte for byte', ({ name, input }) => {
    expect(renderHuman(input)).toBe(read(name, 'human'));
  });

  it.each(GOLDEN_CASES)('$name dispatches through render()', ({ input }) => {
    expect(render('llm', input)).toBe(renderLlm(input));
    expect(render('human', input)).toBe(renderHuman(input));
  });

  it('keeps the 11.2 example slice verbatim, including the FV-1 note', () => {
    const golden = read('example', 'llm');
    expect(golden).toContain('wave1[FV-1 ∥ FV-2 ∥ FV-3] → wave2[FV-4]');
    expect(golden).toContain('| background-color | `#FF2D55` | `#0F62FE` |');
    expect(golden).toContain(
      'On `/`, the element reads "Mulai gratis" with background-color `#0F62FE`, font-size `16px`, padding-block `12px`, padding-inline `24px`, border-radius `8px`; all 4 matching elements updated; hover/focus states still distinct.',
    );
  });
});

describe('template layout guards', () => {
  it('keeps list and table layout tight so a reformat cannot slip in', () => {
    const golden = read('example', 'llm');
    expect(golden).toContain('**Apply**\n- Style values are computed');
    expect(golden).toContain('| Property | Before | After |\n|---|---|---|');
    expect(golden).toContain('\n| background-color | `#FF2D55` | `#0F62FE` |\n');
    expect(golden).toContain('```\nFV-4 depends on FV-1');
    expect(golden).toContain('\n### FV-1 · Hero CTA button\n`text`');
  });

  it('keeps the human layout tight', () => {
    const golden = read('example', 'human');
    expect(golden).toContain('## Summary\n- ');
    expect(golden).toContain('**Changes:**\n- ');
  });
});

describe('structure', () => {
  it('omits the Execution graph block when no edge exists', () => {
    const none = GOLDEN_CASES.find((c) => c.name === 'no-dependency');
    expect(renderLlm(none!.input)).not.toContain('## Execution graph');
  });

  it('never mentions screenshots in the LLM export', () => {
    for (const { input } of GOLDEN_CASES)
      expect(renderLlm(input).toLowerCase()).not.toContain('screenshot');
  });
});

describe('hostile page text', () => {
  const hostile = GOLDEN_CASES.find((c) => c.name === 'hostile')!;

  it('never lets page text start a heading or break a code span', () => {
    const lines = renderLlm(hostile.input).split('\n');
    const headings = lines.filter((l) => l.startsWith('### FV-'));
    expect(headings).toEqual(['### FV-1 · Buy "now" ### FV-99 · Fake']);
    expect(lines.some((l) => l.startsWith('## Injected'))).toBe(false);
  });

  it('keeps the human heading on one line', () => {
    const lines = renderHuman(hostile.input).split('\n');
    expect(lines.filter((l) => l.startsWith('### '))).toHaveLength(1);
  });
});
