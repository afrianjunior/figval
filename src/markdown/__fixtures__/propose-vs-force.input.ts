import type { ExportInput } from '../types';
import { makeNote, makeSession, NOW } from './builders';

const notes = [
  makeNote({
    seq: 1,
    target: { label: 'Pricing link', text: 'Pricing', selector: 'nav a:nth-of-type(2)' },
    why: 'Not obvious that this opens a new page',
    comment: 'Maybe add an icon?',
  }),
  makeNote({
    seq: 2,
    target: { label: 'Footer note', text: 'All rights reserved', selector: 'footer small' },
    comment: 'Drop the year range',
    forceApply: true,
  }),
  makeNote({
    seq: 3,
    target: { label: 'Nav logo', selector: 'nav img' },
    forceApply: true,
  }),
];

export const input: ExportInput = { session: makeSession(notes), notes, now: NOW };
