import { count } from './plural';

export const STYLE_PROPERTIES = [
  'color',
  'background-color',
  'font-size',
  'font-weight',
  'padding-block',
  'padding-inline',
  'border-radius',
  'text-align',
] as const;
export type CopyStyleProperty = (typeof STYLE_PROPERTIES)[number];

const code = (v: string): string => `\`${v}\``;

export const markdownHuman = {
  title: (subject: string): string => `Website review: ${subject}`,
  metaLine: (date: string, notes: number, pages: number): string =>
    `**Date:** ${date} · **Notes:** ${notes} · **Pages:** ${pages}`,
  screenSize: (width: number, height: number): string =>
    `**Screen size during review:** ${width}×${height}`,
  pageUrl: (url: string): string => `**Page:** ${url}`,
  summaryHeading: 'Summary',
  summary: {
    textChange: (n: number): string => count(n, 'text change', 'text changes'),
    styleChange: (n: number): string => count(n, 'style change', 'style changes'),
    elementRemoved: (n: number): string => count(n, 'element removed', 'elements removed'),
    comment: (n: number): string => count(n, 'comment', 'comments'),
  },
  pageHeading: (title: string, path: string): string => `${title} (${code(path)})`,
  noteHeading: (index: number, label: string): string => `${index}. ${label}`,
  note: (text: string): string => `**Note:** ${text}`,
  changesLabel: '**Changes:**',
  textChanged: (before: string, after: string): string =>
    `Text changed from "${before}" to **"${after}"**`,
  styleChanged: {
    'background-color': (b: string, a: string): string =>
      `Background color from ${code(b)} to ${code(a)}`,
    color: (b: string, a: string): string => `Text color from ${code(b)} to ${code(a)}`,
    'font-size': (b: string, a: string): string => `Text size from ${b} to ${a}`,
    'font-weight': (b: string, a: string): string => `Font weight from ${b} to ${a}`,
    'padding-block': (b: string, a: string): string => `Vertical padding from ${b} to ${a}`,
    'padding-inline': (b: string, a: string): string => `Horizontal padding from ${b} to ${a}`,
    'border-radius': (b: string, a: string): string => `Corner radius from ${b} to ${a}`,
    'text-align': (b: string, a: string): string => `Text alignment from ${b} to ${a}`,
  } satisfies Record<CopyStyleProperty, (before: string, after: string) => string>,
  paddingBoth: (vb: string, va: string, hb: string, ha: string): string =>
    `Vertical padding from ${vb} to ${va}, horizontal from ${hb} to ${ha}`,
  appliesToAll: (n: number): string => `Applies to **all similar elements** (${n})`,
  elementRemoved: 'Element removed',
  screenshotHint: (id: string): string => `_Screenshot available in Figval: ${id}_`,
  technical: {
    summary: 'Technical details',
    id: (id: string): string => `ID: ${id}`,
    selector: (selector: string): string => `Selector: ${code(selector)}`,
  },
} as const;
