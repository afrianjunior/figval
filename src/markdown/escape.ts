/** Escaping for page-derived text so it cannot break Markdown structure. */

const WHITESPACE_RUN = /\s+/g;
const BACKTICK_RUN = /`+/g;

/** Collapse every whitespace run (newlines included) to one space; edges kept. */
export const collapse = (s: string): string => s.replace(WHITESPACE_RUN, ' ');

/** Collapse whitespace runs to single spaces and trim. */
export const oneLine = (s: string): string => collapse(s).trim();

/** One-line text with `"` escaped, ready between double quotes. */
export const escapeQuotes = (s: string): string => collapse(s).replace(/"/g, '\\"');

/** `"…"` on one line with inner quotes escaped. */
export const quoted = (s: string): string => `"${escapeQuotes(oneLine(s))}"`;

/** Inline code span (CommonMark): fence longer than any inner backtick run. */
export const inlineCode = (s: string): string => {
  const body = oneLine(s);
  const longest = Math.max(0, ...(body.match(BACKTICK_RUN) ?? []).map((run) => run.length));
  const fence = '`'.repeat(longest + 1);
  const pad = body.startsWith('`') || body.endsWith('`') ? ' ' : '';
  return `${fence}${pad}${body}${pad}${fence}`;
};
