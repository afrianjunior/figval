import type { StyleChange } from '../domain';
import { inlineCode } from './escape';

const cell = (value: string): string => inlineCode(value.replace(/\|/g, '\\|'));

/** Unpadded pipe table, exactly the 11.2 layout. */
export const styleTable = (changes: readonly StyleChange[]): readonly string[] => [
  '| Property | Before | After |',
  '|---|---|---|',
  ...changes.map((c) => `| ${c.property} | ${cell(c.before)} | ${cell(c.after)} |`),
];
