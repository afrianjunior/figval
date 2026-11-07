import type { ExportInput } from '../types';
import { makeNote, makeSession, NOW } from './builders';

const heroCta = makeNote({
  seq: 1,
  shotted: true,
  target: {
    label: 'Hero CTA button',
    text: 'Daftar Sekarang Juga!!',
    attrs: { testid: 'hero-cta' },
    domPath: [
      { tag: 'main', classes: [] },
      { tag: 'section', classes: ['hero'] },
      { tag: 'div', classes: ['hero__inner'] },
      { tag: 'a', classes: ['btn-primary'] },
    ],
    selector: 'section.hero > div > a.btn-primary',
    html: '<a class="btn-primary hero__cta" data-testid="hero-cta" href="/signup">Daftar Sekarang Juga!!</a>',
  },
  why: 'Too loud, match the button style on /pricing',
  edits: {
    text: { before: 'Daftar Sekarang Juga!!', after: 'Mulai gratis' },
    style: [
      { property: 'background-color', before: '#FF2D55', after: '#0F62FE' },
      { property: 'font-size', before: '20px', after: '16px' },
      { property: 'padding-block', before: '20px', after: '12px' },
      { property: 'padding-inline', before: '48px', after: '24px' },
      { property: 'border-radius', before: '0px', after: '8px' },
    ],
    scope: 'similar',
    similarSelector: 'a.btn-primary',
    similarCount: 4,
  },
});

const headline = makeNote({
  seq: 2,
  target: {
    label: 'Hero headline',
    text: 'Ship faster',
    selector: 'section.hero h1',
    domPath: [
      { tag: 'main', classes: [] },
      { tag: 'section', classes: ['hero'] },
      { tag: 'h1', classes: [] },
    ],
    html: '<h1>Ship faster</h1>',
  },
  comment: 'Is this claim backed by anything we can show?',
});

const pricingCta = makeNote({
  seq: 3,
  url: 'https://example.com/pricing?ref=nav#plans',
  title: 'Pricing',
  viewport: { w: 1280, h: 720 },
  target: {
    label: 'Plan heading',
    text: 'Choose a plan',
    selector: 'main h2',
    html: '<h2>Choose a plan</h2>',
  },
  edits: { text: { before: 'Choose a plan', after: 'Pick a plan' } },
});

const footerCta = makeNote({
  seq: 4,
  target: {
    label: 'Footer signup link',
    text: 'Daftar',
    classes: ['btn-primary', 'footer__cta'],
    selector: 'footer a.btn-primary',
    html: '<a class="btn-primary footer__cta" href="/signup">Daftar</a>',
  },
  comment: 'Keep the muted tone here',
  edits: { style: [{ property: 'background-color', before: '#FF2D55', after: '#6B7280' }] },
});

const notes = [heroCta, headline, pricingCta, footerCta];

export const input: ExportInput = { session: makeSession(notes), notes, now: NOW };
