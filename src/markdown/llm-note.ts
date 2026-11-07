import {
  formatSeq,
  hasEdits,
  intent,
  tags,
  type DomStep,
  type Note,
  type TargetAttrs,
} from '../domain';
import { fenced, nonEmpty } from './util';
import { styleTable } from './table';
import { verifyLine } from './verify';

const SEP = ' · ';
const ARROW = '→';

const scopeText = (note: Note): string =>
  note.edits.scope === 'similar'
    ? `**all similar** (${note.edits.similarCount} found)`
    : '**this element**';

const headerTags = (note: Note): readonly string[] => {
  const list = tags(note);
  return list.length === 0 ? [] : [list.map((t) => `\`${t}\``).join(' ')];
};

const headerLine = (note: Note): string =>
  [
    ...headerTags(note),
    `scope: ${scopeText(note)}`,
    `intent: **${intent(note)}**`,
    `state: ${note.target.state}`,
  ].join(SEP);

const whyLines = (note: Note): readonly string[] => {
  const { why, comment } = note;
  const edited = hasEdits(note);
  const lines: string[] = [];
  if (why !== '') lines.push(`**Why:** ${why}`);
  else if (comment !== '' && edited) lines.push(`**Why:** ${comment}`);
  if (comment !== '' && (why !== '' || !edited)) lines.push(`**Comment:** ${comment}`);
  return lines;
};

const attrPairs = (attrs: TargetAttrs): readonly string[] =>
  [
    ['data-testid', attrs.testid],
    ['id', attrs.id],
    ['aria-label', attrs.ariaLabel],
    ['role', attrs.role],
    ['name', attrs.name],
  ].flatMap(([key, value]) => (nonEmpty(value) ? [`\`${key}="${value}"\``] : []));

const stepText = (step: DomStep): string => {
  const id = nonEmpty(step.id) ? `#${step.id}` : '';
  const classes = step.classes.map((c) => `.${c}`).join('');
  const testid = nonEmpty(step.testid) ? `[data-testid="${step.testid}"]` : '';
  const nth = step.nth === undefined ? '' : `:nth-of-type(${step.nth})`;
  return `${step.tag}${id}${classes}${testid}${nth}`;
};

const domPathLines = (path: readonly DomStep[]): readonly string[] => [
  '- DOM path:',
  '  ```',
  ...path.map((step, i) => (i === 0 ? '  ' : `${' '.repeat(2 + 2 * i)}${ARROW} `) + stepText(step)),
  '  ```',
];

const locateLines = (note: Note): readonly string[] => {
  const { target } = note;
  const lines: string[] = [];
  if (target.text !== '') lines.push(`- Text: "${target.text}"`);
  if (target.selection !== null) {
    const { text, before, after } = target.selection;
    lines.push(`- Selected text: "${text}"`, `- Context: "…${before}**${text}**${after}…"`);
  }
  const attrs = attrPairs(target.attrs);
  if (attrs.length > 0) lines.push(`- Attributes: ${attrs.join(', ')}`);
  if (target.domPath.length > 0) lines.push(...domPathLines(target.domPath));
  if (target.selector !== '') lines.push(`- Selector: \`${target.selector}\``);
  return ['**Locate**', ...lines];
};

/** Bullets sit directly under the label; the table follows after one blank line. */
const changeLines = (note: Note): readonly string[] => {
  const { text, style, hidden } = note.edits;
  const bullets = [
    ...(text === null ? [] : [`- Text: \`${text.before}\` → \`${text.after}\``]),
    ...(hidden ? ['- Remove this element.'] : []),
  ];
  const table = style.length > 0 ? styleTable(style) : [];
  if (bullets.length === 0 && table.length === 0) return [];
  const gap = bullets.length > 0 && table.length > 0 ? [''] : [];
  return ['**Change**', ...bullets, ...gap, ...table];
};

const htmlLines = (note: Note): readonly string[] =>
  note.target.html === '' ? [] : ['**HTML**', ...fenced('html', note.target.html)];

/** One `### FV-n` section, as paragraphs separated by a blank line when joined. */
export const noteBlocks = (note: Note, pagePath: string): readonly (readonly string[])[] => {
  const heading = `### ${formatSeq(note.seq)}${SEP}${note.target.label}`;
  return [
    [heading, headerLine(note)],
    ...whyLines(note).map((l) => [l]),
    locateLines(note),
    changeLines(note),
    [verifyLine(note, pagePath)],
    htmlLines(note),
  ].filter((b) => b.length > 0);
};
