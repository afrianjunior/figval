import type { ExportInput } from '../types';
import { makeNote, makeSession, NOW } from './builders';

const sharedClasses = ['cta'];

const notes = [
  makeNote({
    seq: 1,
    url: 'https://example.com/',
    target: { label: 'Home button', classes: sharedClasses, selector: 'main button.cta' },
    edits: {
      style: [{ property: 'background-color', before: '#111111', after: '#0F62FE' }],
      scope: 'similar',
      similarSelector: 'button.cta',
      similarCount: 3,
    },
  }),
  makeNote({
    seq: 2,
    url: 'https://example.com/pricing',
    title: 'Pricing',
    target: { label: 'Pricing button', classes: sharedClasses, selector: 'main button.cta' },
    edits: { style: [{ property: 'background-color', before: '#111111', after: '#0F62FE' }] },
  }),
];

export const input: ExportInput = { session: makeSession(notes), notes, now: NOW };
