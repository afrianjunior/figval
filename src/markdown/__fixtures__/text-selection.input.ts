import type { ExportInput } from '../types';
import { makeNote, makeSession, NOW } from './builders';

const notes = [
  makeNote({
    seq: 1,
    url: 'https://example.com/blog/launch',
    title: 'Launch post',
    target: {
      kind: 'text',
      label: 'Selected text',
      text: 'We shipped the new editor last week and it is already used by half of our beta users.',
      selection: { text: 'half of our beta users', before: 'already used by ', after: '.' },
      selector: 'article p:nth-of-type(2)',
      html: '<p>We shipped the new editor last week and it is already used by half of our beta users.</p>',
    },
    comment: 'Where does this number come from?',
  }),
];

export const input: ExportInput = { session: makeSession(notes), notes, now: NOW };
