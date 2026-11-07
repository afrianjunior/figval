import { copy } from '../copy';
import { formatSeq, hasEdits, type Note, type StyleChange, type TargetAttrs } from '../domain';
import { fenced, nonEmpty } from './util';
import type { ShotLookup } from './types';

const h = copy.markdownHuman;

const bullet = (text: string): string => `- ${text}`;

const find = (
  changes: readonly StyleChange[],
  property: StyleChange['property'],
): StyleChange | undefined => changes.find((c) => c.property === property);

/** Style lines in stored order; both padding props collapse into one line at the first one's slot. */
const styleLines = (changes: readonly StyleChange[]): readonly string[] => {
  const block = find(changes, 'padding-block');
  const inline = find(changes, 'padding-inline');
  const merged = block !== undefined && inline !== undefined;
  const seen = { padding: false };
  return changes.flatMap((c) => {
    const isPadding = c.property === 'padding-block' || c.property === 'padding-inline';
    if (!merged || !isPadding) return [h.styleChanged[c.property](c.before, c.after)];
    if (seen.padding) return [];
    seen.padding = true;
    return [h.paddingBoth(block.before, block.after, inline.before, inline.after)];
  });
};

const changeLines = (note: Note): readonly string[] => {
  const { text, style, hidden, scope, similarCount } = note.edits;
  const lines = [
    ...(text === null ? [] : [h.textChanged(text.before, text.after)]),
    ...styleLines(style),
    ...(hidden ? [h.elementRemoved] : []),
  ];
  if (lines.length === 0) return [];
  return scope === 'similar' ? [...lines, h.appliesToAll(similarCount)] : lines;
};

const noteTexts = (note: Note): readonly string[] =>
  [note.why, note.comment].filter((t) => t !== '').map((t) => h.note(t));

export const hasShot = (note: Note, shots: ShotLookup | undefined): boolean => {
  if (shots === undefined) return note.shots.before !== null || note.shots.after !== null;
  return typeof shots === 'function' ? shots(note) : shots.has(note.id);
};

const attrBullets = (attrs: TargetAttrs): readonly string[] =>
  [
    ['data-testid', attrs.testid],
    ['id', attrs.id],
    ['aria-label', attrs.ariaLabel],
    ['role', attrs.role],
    ['name', attrs.name],
  ].flatMap(([key, value]) => (nonEmpty(value) ? [bullet(`\`${key}="${value}"\``)] : []));

const technicalBlock = (note: Note): readonly string[] => {
  const { target } = note;
  const list = [
    bullet(h.technical.id(formatSeq(note.seq))),
    ...(target.selector === '' ? [] : [bullet(h.technical.selector(target.selector))]),
    ...attrBullets(target.attrs),
  ];
  return [
    '<details>',
    `<summary>${h.technical.summary}</summary>`,
    '',
    ...list,
    ...(target.html === '' ? [] : ['', ...fenced('html', target.html)]),
    '</details>',
  ];
};

/** Blocks for one note; `index` is its 1-based position in the export. */
export const humanNoteBlocks = (
  note: Note,
  index: number,
  shots: ShotLookup | undefined,
): readonly (readonly string[])[] => {
  const changes = hasEdits(note) ? changeLines(note) : [];
  const [first = [], ...rest] = [
    ...noteTexts(note).map((t) => [t]),
    ...(changes.length === 0 ? [] : [[h.changesLabel, ...changes.map(bullet)]]),
    ...(hasShot(note, shots) ? [[h.screenshotHint(formatSeq(note.seq))]] : []),
    technicalBlock(note),
  ];
  return [[`### ${h.noteHeading(index, note.target.label)}`, ...first], ...rest];
};
