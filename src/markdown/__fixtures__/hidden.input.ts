import type { ExportInput } from '../types';
import { makeNote, makeSession, NOW } from './builders';

const notes = [
  makeNote({
    seq: 1,
    shotted: true,
    target: {
      label: 'Cookie banner',
      attrs: { role: 'dialog', name: 'cookies' },
      classes: ['cookie-banner'],
      selector: 'div.cookie-banner',
      html: '<div class="cookie-banner" role="dialog">We use cookies</div>',
    },
    why: 'Covers the signup button on mobile',
    edits: { hidden: true },
  }),
  makeNote({
    seq: 2,
    target: { label: 'Promo strip', text: 'Free shipping', selector: 'div.promo' },
    comment: 'Remove, then fix the spacing',
    edits: { hidden: true, style: [{ property: 'padding-block', before: '12px', after: '0px' }] },
  }),
];

export const input: ExportInput = { session: makeSession(notes), notes, now: NOW };
