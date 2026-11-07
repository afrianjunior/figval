import type { ExportInput } from '../types';
import { input as example } from './example.input';
import { input as hidden } from './hidden.input';
import { input as hostile } from './hostile.input';
import { input as multiHost } from './multi-host.input';
import { input as multiPage } from './multi-page.input';
import { input as noDependency } from './no-dependency.input';
import { input as proposeVsForce } from './propose-vs-force.input';
import { input as similarDependency } from './similar-dependency.input';
import { input as singlePage } from './single-page.input';
import { input as textSelection } from './text-selection.input';

export interface GoldenCase {
  readonly name: string;
  readonly input: ExportInput;
}

export const GOLDEN_CASES: readonly GoldenCase[] = [
  { name: 'example', input: example },
  { name: 'single-page', input: singlePage },
  { name: 'multi-page', input: multiPage },
  { name: 'multi-host', input: multiHost },
  { name: 'text-selection', input: textSelection },
  { name: 'propose-vs-force', input: proposeVsForce },
  { name: 'hidden', input: hidden },
  { name: 'similar-dependency', input: similarDependency },
  { name: 'no-dependency', input: noDependency },
  { name: 'hostile', input: hostile },
];
