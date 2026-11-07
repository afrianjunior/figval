import { copy, formatLongDate } from '../copy';
import { tags, type Note, type PageGroup } from '../domain';
import { oneLine } from './escape';
import { humanNoteBlocks } from './human-note';
import { exportTitle } from './title';
import type { ExportInput } from './types';
import { pagesOf } from './util';

const h = copy.markdownHuman;
const RULE = ['---'];

const tally = (notes: readonly Note[], tag: ReturnType<typeof tags>[number]): number =>
  notes.filter((n) => tags(n).includes(tag)).length;

const SUMMARY_ROWS = [
  ['text', h.summary.textChange],
  ['style', h.summary.styleChange],
  ['hide', h.summary.elementRemoved],
  ['comment', h.summary.comment],
] as const;

const summaryLines = (notes: readonly Note[]): readonly string[] =>
  SUMMARY_ROWS.flatMap(([tag, render]) => {
    const n = tally(notes, tag);
    return n > 0 ? [`- ${render(n)}`] : [];
  });

const summaryBlock = (notes: readonly Note[]): readonly (readonly string[])[] => {
  const lines = summaryLines(notes);
  return lines.length === 0 ? [] : [[`## ${h.summaryHeading}`, ...lines]];
};

/** Single-page exports carry the URL on its own line under the screen size. */
const metaBlock = (input: ExportInput, pages: readonly PageGroup[]): readonly string[] => {
  const first = input.notes[0];
  const meta = h.metaLine(formatLongDate(input.now), input.notes.length, pages.length);
  if (first === undefined) return [meta];
  const url = pages.length === 1 ? [h.pageUrl(first.page.url)] : [];
  return [meta, h.screenSize(first.page.viewport.w, first.page.viewport.h), ...url];
};

const pageTitle = (page: PageGroup): string => {
  const title = page.notes[0]?.page.title ?? '';
  return oneLine(title === '' ? page.host : title);
};

interface Numbered {
  readonly blocks: readonly (readonly string[])[];
  readonly next: number;
}

const pageBlocks = (
  page: PageGroup,
  start: number,
  showHeading: boolean,
  shots: ExportInput['shots'],
): Numbered => ({
  blocks: [
    ...(showHeading ? [[`## ${h.pageHeading(pageTitle(page), page.path)}`]] : []),
    ...page.notes.flatMap((note, i) => humanNoteBlocks(note, start + i, shots)),
  ],
  next: start + page.notes.length,
});

const allPageBlocks = (
  input: ExportInput,
  pages: readonly PageGroup[],
): readonly (readonly string[])[] => {
  const out: (readonly string[])[] = [];
  let next = 1;
  pages.forEach((page, i) => {
    const part = pageBlocks(page, next, pages.length > 1, input.shots);
    out.push(...(i === 0 ? [] : [RULE]), ...part.blocks);
    next = part.next;
  });
  return out;
};

/** Reader-facing export per 11.4. */
export const renderHuman = (input: ExportInput): string => {
  const pages = pagesOf(input.notes);
  const blocks: readonly (readonly string[])[] = [
    [`# ${exportTitle(input.notes, 'human')}`],
    metaBlock(input, pages),
    ...summaryBlock(input.notes),
    ...(pages.length === 0 ? [] : [RULE]),
    ...allPageBlocks(input, pages),
  ];
  return `${blocks.map((b) => b.join('\n')).join('\n\n')}\n`;
};
