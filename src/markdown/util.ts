import type { Note } from '../domain';
import { groupByPage, type PageGroup } from '../domain';

const ISO_DATE_END = 10;
const ISO_TIME_START = 11;
const ISO_TIME_END = 16;

/** "2026-11-07" in UTC. */
export const isoDate = (ts: number): string => new Date(ts).toISOString().slice(0, ISO_DATE_END);

/** "2026-11-07 14:32" in UTC. */
export const isoDateTime = (ts: number): string => {
  const iso = new Date(ts).toISOString();
  return `${iso.slice(0, ISO_DATE_END)} ${iso.slice(ISO_TIME_START, ISO_TIME_END)}`;
};

/** Pages in export order: a page sits where its first note sits. */
export const pagesOf = (notes: readonly Note[]): readonly PageGroup[] =>
  groupByPage(
    notes,
    notes.map((n) => n.id),
  );

/** Fence long enough to wrap `body` even when it contains backtick runs. */
export const fenceFor = (body: string): string => {
  const longest = Math.max(0, ...(body.match(/`+/g) ?? []).map((run) => run.length));
  return '`'.repeat(Math.max(3, longest + 1));
};

export const fenced = (lang: string, body: string): readonly string[] => {
  const fence = fenceFor(body);
  return [`${fence}${lang}`, body, fence];
};

export const nonEmpty = (value: string | undefined): value is string =>
  value !== undefined && value !== '';
