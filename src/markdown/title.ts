import { copy } from '../copy';
import type { Note } from '../domain';
import { isoDate, pagesOf } from './util';
import type { ExportFormat } from './types';

/** Longest host+path subject kept verbatim in a title. */
export const TITLE_MAX = 48;

const LLM_TITLE_PREFIX = 'Figval Review — ';
const LLM_TITLE_BARE = 'Figval Review';
const ELLIPSIS = '…';

const segmentsOf = (path: string): readonly string[] => path.split('/').filter((s) => s !== '');

/** Keep first and last path segment, replace the middle with an ellipsis. */
const collapseMiddle = (host: string, path: string): string => {
  const segs = segmentsOf(path);
  if (segs.length <= 2) return host + path;
  return `${host}/${segs[0]}/${ELLIPSIS}/${segs[segs.length - 1]}`;
};

const clip = (subject: string): string =>
  subject.length <= TITLE_MAX ? subject : `${subject.slice(0, TITLE_MAX - 1)}${ELLIPSIS}`;

const shorten = (host: string, path: string): string => {
  const full = path === '/' ? host : host + path;
  return full.length <= TITLE_MAX ? full : clip(collapseMiddle(host, path));
};

const subjectOf = (notes: readonly Note[]): string => {
  const pages = pagesOf(notes);
  const [first] = pages;
  if (first === undefined) return '';
  if (pages.length === 1) return shorten(first.host, first.path);
  const hosts = new Set(pages.map((p) => p.host));
  return hosts.size === 1 ? first.host : `${hosts.size} sites`;
};

export const exportTitle = (notes: readonly Note[], format: ExportFormat): string => {
  const subject = subjectOf(notes);
  if (format === 'human') return copy.markdownHuman.title(subject).trimEnd();
  return subject === '' ? LLM_TITLE_BARE : `${LLM_TITLE_PREFIX}${subject}`;
};

const slugify = (raw: string): string =>
  raw
    .replace(/\//g, '-')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

const slugOf = (notes: readonly Note[]): string => {
  const pages = pagesOf(notes);
  const [first] = pages;
  if (first === undefined) return '';
  if (pages.length === 1) return slugify(first.path === '/' ? first.host : first.host + first.path);
  const hosts = new Set(pages.map((p) => p.host));
  return hosts.size === 1 ? slugify(first.host) : `${hosts.size}-sites`;
};

export const exportFilename = (notes: readonly Note[], now: number): string => {
  const slug = slugOf(notes);
  return ['figval', slug, isoDate(now)].filter((p) => p !== '').join('-') + '.md';
};
