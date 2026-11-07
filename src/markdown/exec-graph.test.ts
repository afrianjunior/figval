import { describe, expect, it } from 'vitest';
import { InvariantViolation } from '../domain';
import { makeNote } from './__fixtures__/builders';
import { input as similar } from './__fixtures__/similar-dependency.input';
import { input as noDep } from './__fixtures__/no-dependency.input';
import { execGraph, execGraphLines, levelize } from './exec-graph';

const apply = { style: [{ property: 'color' as const, before: '#000', after: '#fff' }] };

describe('execGraph', () => {
  it('returns null when there is no edge', () => {
    expect(execGraph(noDep.notes)).toBeNull();
    expect(execGraph([])).toBeNull();
  });

  it('builds waves as topological levels sorted by seq', () => {
    const graph = execGraph(similar.notes);
    expect(graph?.waves).toEqual([
      { level: 0, seqs: [1, 4] },
      { level: 1, seqs: [2, 3] },
    ]);
  });

  it('adds an edge for the same selector (variant a) and for shared classes (variant b)', () => {
    const graph = execGraph(similar.notes);
    expect(graph?.edges.map((e) => [e.from, e.to])).toEqual([
      [1, 2],
      [1, 3],
    ]);
    expect(graph?.edges[0]?.reason).toBe(
      'FV-2 depends on FV-1: both edit the same element; FV-2 overrides FV-1 for one instance.',
    );
    expect(graph?.edges[1]?.reason).toBe(
      'FV-3 depends on FV-1: both touch `button.cta`; FV-3 overrides FV-1 for one instance.',
    );
  });

  it('chains dependencies across several levels', () => {
    const a = makeNote({ seq: 1, target: { selector: 'a.x' }, edits: apply });
    const b = makeNote({ seq: 2, target: { selector: 'a.x' }, edits: apply });
    const c = makeNote({ seq: 3, target: { selector: 'a.x' }, edits: apply });
    expect(execGraph([c, a, b])?.waves.map((w) => w.seqs)).toEqual([[1], [2], [3]]);
  });

  it('ignores propose notes and notes on other pages', () => {
    const a = makeNote({ seq: 1, target: { selector: 'a.x' }, edits: apply });
    const proposed = makeNote({ seq: 2, target: { selector: 'a.x' }, comment: 'hm' });
    const elsewhere = makeNote({
      seq: 3,
      url: 'https://example.com/other',
      target: { selector: 'a.x' },
      edits: apply,
    });
    expect(execGraph([a, proposed, elsewhere])).toBeNull();
  });

  it('treats the same page under www, query and trailing slash as one page', () => {
    const a = makeNote({
      seq: 1,
      url: 'https://www.example.com/p/',
      target: { selector: 'a.x' },
      edits: apply,
    });
    const b = makeNote({
      seq: 2,
      url: 'https://example.com/p?x=1#y',
      target: { selector: 'a.x' },
      edits: apply,
    });
    expect(execGraph([a, b])?.edges).toHaveLength(1);
  });

  it('only links forward in seq, so two similar notes cannot cycle', () => {
    const similarEdits = {
      ...apply,
      scope: 'similar' as const,
      similarSelector: '.x',
      similarCount: 2,
    };
    const a = makeNote({ seq: 1, target: { selector: 's1', classes: ['x'] }, edits: similarEdits });
    const b = makeNote({ seq: 2, target: { selector: 's2', classes: ['x'] }, edits: similarEdits });
    expect(execGraph([b, a])?.edges.map((e) => [e.from, e.to])).toEqual([[1, 2]]);
  });

  it('requires at least one class token and every token on the dependent', () => {
    const base = { ...apply, scope: 'similar' as const, similarCount: 2 };
    const a = makeNote({
      seq: 1,
      target: { selector: 's1' },
      edits: { ...base, similarSelector: 'button' },
    });
    const b = makeNote({ seq: 2, target: { selector: 's2', classes: ['x'] }, edits: apply });
    expect(execGraph([a, b])).toBeNull();
    const partial = makeNote({
      seq: 1,
      target: { selector: 's1' },
      edits: { ...base, similarSelector: '.x.y' },
    });
    expect(execGraph([partial, b])).toBeNull();
  });

  it('reads escaped class tokens in the similar selector', () => {
    const a = makeNote({
      seq: 1,
      target: { selector: 's1' },
      edits: { ...apply, scope: 'similar', similarSelector: '.md\\:flex', similarCount: 2 },
    });
    const b = makeNote({ seq: 2, target: { selector: 's2', classes: ['md:flex'] }, edits: apply });
    expect(execGraph([a, b])?.edges).toHaveLength(1);
  });

  it('does not link when similarSelector is null for a similar note', () => {
    const a = makeNote({
      seq: 1,
      target: { selector: 's1' },
      edits: { ...apply, scope: 'similar', similarCount: 2 },
    });
    const b = makeNote({ seq: 2, target: { selector: 's2', classes: ['x'] }, edits: apply });
    expect(execGraph([a, b])).toBeNull();
  });
});

describe('execGraphLines', () => {
  it('renders the fenced wave line and one line per edge, no blank between', () => {
    const graph = execGraph(similar.notes);
    expect(graph).not.toBeNull();
    const lines = execGraphLines(graph!);
    expect(lines.slice(0, 3)).toEqual(['```', 'wave1[FV-1 ∥ FV-4] → wave2[FV-2 ∥ FV-3]', '```']);
    expect(lines[3]).toMatch(/^FV-2 depends on FV-1/);
    expect(lines).toHaveLength(5);
  });
});

describe('levelize', () => {
  it('dies with InvariantViolation on a cycle', () => {
    const edges = [
      { from: 1, to: 2, reason: '' },
      { from: 2, to: 1, reason: '' },
    ];
    expect(() => levelize([1, 2], edges)).toThrow(InvariantViolation);
  });

  it('levels an acyclic graph', () => {
    expect(levelize([1, 2, 3], [{ from: 1, to: 3, reason: '' }])).toEqual([
      { level: 0, seqs: [1, 2] },
      { level: 1, seqs: [3] },
    ]);
  });
});
