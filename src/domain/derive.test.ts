import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';
import { groupByPage, hasEdits, intent, normalizePage, normalizePageKey, tags } from './derive';
import { NoteId, NoteSeq, SessionId, makeUuidV4 } from './ids';
import { emptyEdits, type Edits, type Note } from './records';

const nid = (n: number) => Schema.decodeSync(NoteId)(makeUuidV4((len) => new Uint8Array(len).fill(n)));

const mk = (n: number, url: string, over: Partial<Note> = {}, edits: Partial<Edits> = {}): Note => ({
  schemaVersion: 1,
  id: nid(n),
  seq: Schema.decodeSync(NoteSeq)(n),
  sessionId: Schema.decodeSync(SessionId)('fv-aaaa'),
  createdAt: 0,
  updatedAt: 0,
  page: { url, title: 't', viewport: { w: 1, h: 1 }, dpr: 1 },
  target: {
    kind: 'element', label: 'l', text: '', attrs: {}, classes: [], domPath: [],
    selector: 'a', html: '', selection: null, state: 'rest',
  },
  comment: '',
  why: '',
  forceApply: false,
  edits: { ...emptyEdits, ...edits },
  shots: { before: null, after: null },
  ...over,
});

describe('hasEdits / intent / tags', () => {
  it('is false for empty edits and propose', () => {
    const n = mk(1, 'https://a.com/');
    expect(hasEdits(n)).toBe(false);
    expect(intent(n)).toBe('propose');
    expect(tags(n)).toEqual([]);
  });
  it('detects each edit kind', () => {
    expect(hasEdits(mk(1, 'https://a.com/', {}, { text: { before: 'a', after: 'b' } }))).toBe(true);
    expect(hasEdits(mk(1, 'https://a.com/', {}, { style: [{ property: 'color', before: 'a', after: 'b' }] }))).toBe(true);
    expect(hasEdits(mk(1, 'https://a.com/', {}, { hidden: true }))).toBe(true);
  });
  it('forceApply makes intent apply without edits', () => {
    expect(intent(mk(1, 'https://a.com/', { forceApply: true }))).toBe('apply');
    expect(intent(mk(1, 'https://a.com/', {}, { hidden: true }))).toBe('apply');
  });
  it('orders tags text, style, hide, comment', () => {
    const n = mk(1, 'https://a.com/', { comment: 'hi' }, {
      hidden: true,
      text: { before: 'a', after: 'b' },
      style: [{ property: 'color', before: 'a', after: 'b' }],
    });
    expect(tags(n)).toEqual(['text', 'style', 'hide', 'comment']);
  });
  it('empty comment adds no comment tag', () => {
    expect(tags(mk(1, 'https://a.com/', { comment: '' }, { hidden: true }))).toEqual(['hide']);
  });
});

describe('normalizePage', () => {
  it.each([
    ['https://www.example.com/', 'example.com', '/'],
    ['https://example.com', 'example.com', '/'],
    ['https://example.com/register/', 'example.com', '/register'],
    ['https://example.com/a/b?x=1#h', 'example.com', '/a/b'],
    ['https://example.com/?q=1', 'example.com', '/'],
    ['http://localhost:3000/x/', 'localhost:3000', '/x'],
  ])('%s', (url, host, path) => {
    expect(normalizePage(url)).toEqual({ host, path });
  });
  it('does not throw on invalid urls', () => {
    expect(normalizePage('not a url')).toEqual({ host: '', path: 'not a url' });
    expect(normalizePageKey('not a url')).toBe('not a url');
  });
  it('builds key as host+path', () => {
    expect(normalizePageKey('https://www.example.com/a/?x#y')).toBe('example.com/a');
    expect(normalizePageKey('https://example.com/')).toBe('example.com/');
  });
});

describe('groupByPage', () => {
  const a1 = mk(1, 'https://a.com/x');
  const b2 = mk(2, 'https://b.com/');
  const a3 = mk(3, 'https://www.a.com/x/?q=1');
  const a4 = mk(4, 'https://a.com/y');

  it('orders pages by first note in order, notes by order', () => {
    const groups = groupByPage([a1, b2, a3, a4], [a3.id, b2.id, a1.id, a4.id]);
    expect(groups.map((g) => g.pageKey)).toEqual(['a.com/x', 'b.com/', 'a.com/y']);
    expect(groups[0]?.notes.map((n) => n.seq)).toEqual([3, 1]);
    expect(groups[0]).toMatchObject({ host: 'a.com', path: '/x' });
  });
  it('appends notes missing from order, keeping input order', () => {
    const groups = groupByPage([a1, b2, a4], [b2.id]);
    expect(groups.map((g) => g.pageKey)).toEqual(['b.com/', 'a.com/x', 'a.com/y']);
  });
  it('ignores order ids with no note and handles empty', () => {
    expect(groupByPage([], [a1.id])).toEqual([]);
    expect(groupByPage([a1], [b2.id, a1.id])).toHaveLength(1);
  });
});
