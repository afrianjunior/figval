import type { Note, PageGroup } from '../domain';
import { execGraph, execGraphLines } from './exec-graph';
import { exportTitle } from './title';
import { INSTRUCTIONS_LINES, RETURN_FORMAT_LINES, TEMPLATE_SESSION_ID } from './llm-constants';
import { noteBlocks } from './llm-note';
import type { ExportInput } from './types';
import { oneLine } from './escape';
import { isoDateTime, pagesOf } from './util';

const SEP = ' · ';
const RULE = ['---'];

const countText = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

const metaLine = (input: ExportInput, pageCount: number): string =>
  [
    '> Figval',
    `session \`${input.session.id}\``,
    isoDateTime(input.now),
    countText(input.notes.length, 'change', 'changes'),
    countText(pageCount, 'page', 'pages'),
  ].join(SEP);

const graphBlock = (notes: readonly Note[]): readonly (readonly string[])[] => {
  const graph = execGraph(notes);
  return graph === null ? [] : [['## Execution graph'], execGraphLines(graph)];
};

const pageHeading = (page: PageGroup): string => {
  const first = page.notes[0];
  const title = oneLine(first === undefined || first.page.title === '' ? page.host : first.page.title);
  const vp = first?.page.viewport;
  return `## Page: \`${page.path}\` — ${title}${SEP}viewport ${vp?.w ?? 0}×${vp?.h ?? 0}`;
};

const pageBlocks = (page: PageGroup): readonly (readonly string[])[] => [
  [pageHeading(page), `URL: ${oneLine(page.notes[0]?.page.url ?? '')}`],
  ...page.notes.flatMap((note) => noteBlocks(note, page.path)),
];

const returnFormat = (sessionId: string): readonly string[] =>
  RETURN_FORMAT_LINES.map((l) => l.replace(TEMPLATE_SESSION_ID, sessionId));

/** Agent-facing export, byte for byte per 11.2. */
export const renderLlm = (input: ExportInput): string => {
  const pages = pagesOf(input.notes);
  const blocks: readonly (readonly string[])[] = [
    [`# ${exportTitle(input.notes, 'llm')}`],
    [metaLine(input, pages.length)],
    INSTRUCTIONS_LINES,
    ...graphBlock(input.notes),
    ...pages.flatMap((page) => [RULE, ...pageBlocks(page)]),
    RULE,
    returnFormat(input.session.id),
  ];
  return `${blocks.map((b) => b.join('\n')).join('\n\n')}\n`;
};
