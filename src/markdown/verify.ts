import { intent, type Note, type StyleChange } from '../domain';

const LABEL = '**Verify:**';
const PROPOSE_BODY = 'Reply with a proposed change for this element; do not edit code.';
const STYLE_TAIL = 'hover/focus states still distinct';
const COMMENT_ONLY_CLAUSE = 'matches the request above';

const styleClause = (changes: readonly StyleChange[]): string =>
  `with ${changes.map((c) => `${c.property} \`${c.after}\``).join(', ')}`;

/** Clauses after "the element": removal wins over every other edit. */
const clausesOf = (note: Note): string => {
  const { text, style, hidden } = note.edits;
  if (hidden) return 'is removed';
  const parts = [
    text === null ? null : `reads "${text.after}"`,
    style.length > 0 ? styleClause(style) : null,
  ].filter((p): p is string => p !== null);
  return parts.length > 0 ? parts.join(' ') : COMMENT_ONLY_CLAUSE;
};

const scopeClause = (note: Note): string =>
  note.edits.scope === 'similar'
    ? `; all ${note.edits.similarCount} matching elements updated`
    : '';

const styleTail = (note: Note): string =>
  note.edits.style.length > 0 && !note.edits.hidden ? `; ${STYLE_TAIL}` : '';

/** The single Verify line for a note, deterministic from its fields (11.2). */
export const verifyLine = (note: Note, pagePath: string): string => {
  if (intent(note) === 'propose') return `${LABEL} ${PROPOSE_BODY}`;
  const body = `On \`${pagePath}\`, the element ${clausesOf(note)}${scopeClause(note)}${styleTail(note)}.`;
  return `${LABEL} ${body}`;
};
