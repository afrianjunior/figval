import { formatSeq, InvariantViolation, intent, normalizePageKey, type Note } from '../domain';
import type { ExecEdge, ExecGraph, ExecWave } from './types';

const CLASS_TOKEN = /\.((?:\\.|[\w-])+)/g;

const classTokens = (selector: string): readonly string[] =>
  [...selector.matchAll(CLASS_TOKEN)].map((m) => (m[1] ?? '').replace(/\\(.)/g, '$1'));

const seqLabel = (seq: number): string => formatSeq(seq as Note['seq']);

const sameElementReason = (a: Note, b: Note): string =>
  `${seqLabel(b.seq)} depends on ${seqLabel(a.seq)}: both edit the same element; ${seqLabel(b.seq)} overrides ${seqLabel(a.seq)} for one instance.`;

const sharedStyleReason = (a: Note, b: Note, selector: string): string =>
  `${seqLabel(b.seq)} depends on ${seqLabel(a.seq)}: both touch \`${selector}\`; ${seqLabel(b.seq)} overrides ${seqLabel(a.seq)} for one instance.`;

/** Reason line when `a` must be applied before `b`, otherwise null. */
const dependency = (a: Note, b: Note): string | null => {
  if (a.seq >= b.seq) return null;
  if (normalizePageKey(a.page.url) !== normalizePageKey(b.page.url)) return null;
  if (intent(a) !== 'apply' || intent(b) !== 'apply') return null;
  if (a.target.selector === b.target.selector) return sameElementReason(a, b);
  const selector = a.edits.scope === 'similar' ? a.edits.similarSelector : null;
  if (selector === null) return null;
  const tokens = classTokens(selector);
  const covered = tokens.length > 0 && tokens.every((t) => b.target.classes.includes(t));
  return covered ? sharedStyleReason(a, b, selector) : null;
};

const collectEdges = (sorted: readonly Note[]): readonly ExecEdge[] =>
  sorted.flatMap((a, i) =>
    sorted.slice(i + 1).flatMap((b) => {
      const reason = dependency(a, b);
      return reason === null ? [] : [{ from: a.seq as number, to: b.seq as number, reason }];
    }),
  );

/** Topological levels (Kahn). A cycle is a defect: nothing in 11.3 can create one. */
export const levelize = (
  seqs: readonly number[],
  edges: readonly ExecEdge[],
): readonly ExecWave[] => {
  const level = new Map<number, number>();
  let remaining = [...seqs];
  let current = 0;
  const waves: ExecWave[] = [];
  while (remaining.length > 0) {
    const ready = remaining.filter((s) =>
      edges.filter((e) => e.to === s).every((e) => level.has(e.from)),
    );
    if (ready.length === 0)
      throw new InvariantViolation({ what: 'execution graph contains a cycle' });
    ready.forEach((s) => level.set(s, current));
    waves.push({ level: current, seqs: [...ready].sort((x, y) => x - y) });
    remaining = remaining.filter((s) => !ready.includes(s));
    current += 1;
  }
  return waves;
};

/** Null when no dependency edge exists, so the export omits the graph block. */
export const execGraph = (notes: readonly Note[]): ExecGraph | null => {
  const sorted = [...notes].sort((a, b) => a.seq - b.seq);
  const edges = collectEdges(sorted);
  if (edges.length === 0) return null;
  const ordered = [...edges].sort((x, y) => x.to - y.to || x.from - y.from);
  return {
    waves: levelize(
      sorted.map((n) => n.seq as number),
      ordered,
    ),
    edges: ordered,
  };
};

/** Body of the Execution graph block: fenced wave line, then one line per edge. */
export const execGraphLines = (graph: ExecGraph): readonly string[] => {
  const waves = graph.waves
    .map((w) => `wave${w.level + 1}[${w.seqs.map(seqLabel).join(' ∥ ')}]`)
    .join(' → ');
  return ['```', waves, '```', ...graph.edges.map((e) => e.reason)];
};
