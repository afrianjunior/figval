import type { ExportInput } from '../types';
import { makeNote, makeSession, NOW } from './builders';

const notes = [
  makeNote({
    seq: 1,
    url: 'https://example.com/',
    title: 'Home',
    target: { label: 'Banner', text: 'Welcome', selector: 'header h1' },
    edits: { text: { before: 'Welcome', after: 'Hello' } },
  }),
  makeNote({
    seq: 2,
    url: 'http://www.staging.example.dev:8080/docs/getting-started/install/linux/ubuntu/',
    title: 'Install on Ubuntu',
    target: { label: 'Install command', selector: 'pre code' },
    comment: 'The flag is missing here',
  }),
];

export const input: ExportInput = { session: makeSession(notes), notes, now: NOW };
