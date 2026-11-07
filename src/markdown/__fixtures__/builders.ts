import { Schema } from 'effect';
import {
  emptyEdits,
  NoteId,
  NoteSeq,
  SessionId,
  ShotId,
  type Edits,
  type Note,
  type Session,
  type Target,
} from '../../domain';

export const SESSION_ID = Schema.decodeSync(SessionId)('fv-7k2q');
/** 2026-11-07 14:32 UTC */
export const NOW = Date.UTC(2026, 10, 7, 14, 32);

const uuid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const noteId = (n: number): NoteId => Schema.decodeSync(NoteId)(uuid(n));

const baseTarget: Target = {
  kind: 'element',
  label: 'Element',
  text: '',
  attrs: {},
  classes: [],
  domPath: [],
  selector: '',
  html: '',
  selection: null,
  state: 'rest',
};

export interface NoteSpec {
  readonly seq: number;
  readonly url?: string;
  readonly title?: string;
  readonly viewport?: { readonly w: number; readonly h: number };
  readonly target?: Partial<Target>;
  readonly comment?: string;
  readonly why?: string;
  readonly forceApply?: boolean;
  readonly edits?: Partial<Edits>;
  readonly shotted?: boolean;
}

export const makeNote = (spec: NoteSpec): Note => ({
  schemaVersion: 1,
  id: noteId(spec.seq),
  seq: Schema.decodeSync(NoteSeq)(spec.seq),
  sessionId: SESSION_ID,
  createdAt: NOW,
  updatedAt: NOW,
  page: {
    url: spec.url ?? 'https://example.com/',
    title: spec.title ?? 'Home',
    viewport: spec.viewport ?? { w: 1440, h: 900 },
    dpr: 2,
  },
  target: { ...baseTarget, ...spec.target },
  comment: spec.comment ?? '',
  why: spec.why ?? '',
  forceApply: spec.forceApply ?? false,
  edits: { ...emptyEdits, ...spec.edits },
  shots: {
    before: spec.shotted === true ? Schema.decodeSync(ShotId)(uuid(spec.seq + 500)) : null,
    after: null,
  },
});

export const makeSession = (notes: readonly Note[]): Session => ({
  schemaVersion: 1,
  id: SESSION_ID,
  name: 'example.com · Nov 7',
  createdAt: NOW,
  updatedAt: NOW,
  nextSeq: Schema.decodeSync(NoteSeq)(notes.length + 1),
  noteOrder: notes.map((n) => n.id),
});
