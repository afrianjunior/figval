import { Schema } from 'effect';
import { NoteId, NoteSeq, SessionId, ShotId, emptyEdits, type Note, type Session } from '../domain';

export const sid = (s = 'fv-aaaa'): SessionId => Schema.decodeSync(SessionId)(s);
export const nid = (n: number): NoteId =>
  Schema.decodeSync(NoteId)(`00000000-0000-4000-8000-${String(n).padStart(12, '0')}`);
export const shotId = (n: number): ShotId =>
  Schema.decodeSync(ShotId)(`11111111-0000-4000-8000-${String(n).padStart(12, '0')}`);

export const makeSession = (id = 'fv-aaaa', over: Partial<Session> = {}): Session => ({
  schemaVersion: 1,
  id: sid(id),
  name: 'example.com · Nov 7',
  createdAt: 1,
  updatedAt: 1,
  nextSeq: Schema.decodeSync(NoteSeq)(1),
  noteOrder: [],
  ...over,
});

export const makeNote = (n: number, session = 'fv-aaaa', over: Partial<Note> = {}): Note => ({
  schemaVersion: 1,
  id: nid(n),
  seq: Schema.decodeSync(NoteSeq)(n),
  sessionId: sid(session),
  createdAt: 1,
  updatedAt: 1,
  page: { url: 'https://example.com/', title: 'Example', viewport: { w: 1440, h: 900 }, dpr: 2 },
  target: {
    kind: 'element',
    label: 'Button',
    text: 'Go',
    attrs: {},
    classes: [],
    domPath: [],
    selector: 'button',
    html: '<button>Go</button>',
    selection: null,
    state: 'rest',
  },
  comment: '',
  why: '',
  forceApply: false,
  edits: emptyEdits,
  shots: { before: null, after: null },
  ...over,
});
