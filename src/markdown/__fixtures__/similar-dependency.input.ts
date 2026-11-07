import type { ExportInput } from '../types';
import { makeNote, makeSession, NOW } from './builders';

const notes = [
  makeNote({
    seq: 1,
    target: { label: 'Primary button', classes: ['cta', 'cta--lg'], selector: 'main button.cta' },
    edits: {
      style: [{ property: 'border-radius', before: '0px', after: '6px' }],
      scope: 'similar',
      similarSelector: 'button.cta',
      similarCount: 7,
    },
  }),
  makeNote({
    seq: 2,
    target: { label: 'Primary button', classes: ['cta', 'cta--lg'], selector: 'main button.cta' },
    why: 'Same button, needs a different label',
    edits: { text: { before: 'Send', after: 'Send message' } },
  }),
  makeNote({
    seq: 3,
    target: { label: 'Sidebar button', classes: ['cta'], selector: 'aside button.cta' },
    edits: { style: [{ property: 'color', before: '#111111', after: '#FFFFFF' }] },
  }),
  makeNote({
    seq: 4,
    target: { label: 'Cancel link', classes: ['link'], selector: 'form a.link' },
    edits: { style: [{ property: 'text-align', before: 'left', after: 'center' }] },
  }),
];

export const input: ExportInput = { session: makeSession(notes), notes, now: NOW };
