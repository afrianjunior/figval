import type { ExportInput } from '../types';
import { makeNote, makeSession, NOW } from './builders';

const notes = [
  makeNote({
    seq: 1,
    url: 'https://example.com/about/',
    title: 'About',
    target: { label: 'Team intro', text: 'Meet the team', selector: 'main > p' },
    edits: { text: { before: 'Meet the team', after: 'Who we are' } },
  }),
  makeNote({
    seq: 2,
    url: 'https://example.com/contact',
    title: 'Contact',
    viewport: { w: 390, h: 844 },
    target: { label: 'Email link', text: 'hello@example.com', selector: 'footer a' },
    comment: 'Should this be a form instead?',
  }),
  makeNote({
    seq: 3,
    url: 'https://example.com/about#team',
    title: 'About',
    target: { label: 'Team photo', selector: 'main img' },
    edits: { hidden: true },
  }),
];

export const input: ExportInput = { session: makeSession(notes), notes, now: NOW };
