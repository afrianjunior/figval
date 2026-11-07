import type { ExportInput } from '../types';
import { makeNote, makeSession, NOW } from './builders';

const notes = [
  makeNote({
    seq: 1,
    url: 'https://www.example.com/register/?plan=pro#top',
    title: 'Register',
    viewport: { w: 1024, h: 768 },
    target: {
      label: 'Register heading',
      text: 'Create your account',
      attrs: { id: 'register-title', ariaLabel: 'Registration' },
      domPath: [
        { tag: 'main', classes: [] },
        { tag: 'form', id: 'register', classes: [] },
        { tag: 'h1', classes: ['title'], nth: 1 },
      ],
      selector: '#register-title',
      html: '<h1 id="register-title" class="title">Create your account</h1>',
    },
    why: 'Sounds like a bank form',
    edits: {
      text: { before: 'Create your account', after: 'Join in a minute' },
      style: [{ property: 'font-weight', before: '400', after: '700' }],
    },
  }),
];

export const input: ExportInput = { session: makeSession(notes), notes, now: NOW };
