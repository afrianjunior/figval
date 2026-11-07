import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';
import { NoteDraft, NotePatch } from './draft';
import * as errors from './errors';
import { NoteId, TabId, makeNoteId, makeShotId, makeSessionId } from './ids';
import { Edits, Note, STYLE_PROPERTIES, Session, Settings, Target, defaultSettings, emptyEdits } from './records';

const bytes = (n: number) => new Uint8Array(n).fill(9);
const noteId = makeNoteId(bytes);

const target = {
  kind: 'element', label: 'Hero', text: 'Hi', attrs: { testid: 'x' }, classes: ['a'],
  domPath: [{ tag: 'main', classes: [] }], selector: 'main', html: '<a/>', selection: null, state: 'rest',
};
const page = { url: 'https://a.com/', title: 'A', viewport: { w: 1, h: 2 }, dpr: 2 };
const draft = { page, target, comment: '', why: '', forceApply: false, edits: emptyEdits };

describe('records', () => {
  it('defaultSettings decodes', () => {
    expect(Schema.decodeUnknownSync(Settings)(defaultSettings)).toEqual(defaultSettings);
    expect(defaultSettings.preset).toBe('reviewer');
  });
  it('rejects wrong schemaVersion', () => {
    expect(() => Schema.decodeUnknownSync(Settings)({ ...defaultSettings, schemaVersion: 2 })).toThrow();
  });
  it('decodes a session', () => {
    const s = { schemaVersion: 1, id: makeSessionId(() => 0.5), name: 'a', createdAt: 1, updatedAt: 1, nextSeq: 1, noteOrder: [noteId] };
    expect(Schema.decodeUnknownSync(Session)(s).noteOrder).toHaveLength(1);
    expect(() => Schema.decodeUnknownSync(Session)({ ...s, nextSeq: 0 })).toThrow();
  });
  it('decodes a note and rejects bad ids', () => {
    const n = {
      schemaVersion: 1, id: noteId, seq: 1, sessionId: 'fv-abcd', createdAt: 1, updatedAt: 1,
      ...draft, shots: { before: null, after: makeShotId(bytes) },
    };
    expect(Schema.decodeUnknownSync(Note)(n).seq).toBe(1);
    expect(() => Schema.decodeUnknownSync(Note)({ ...n, id: 'x' })).toThrow();
  });
  it('limits domPath to 6 and style properties to the union', () => {
    const step = { tag: 'a', classes: [] };
    expect(() => Schema.decodeUnknownSync(Target)({ ...target, domPath: Array(7).fill(step) })).toThrow();
    expect(() => Schema.decodeUnknownSync(Edits)({ ...emptyEdits, style: [{ property: 'margin', before: '', after: '' }] })).toThrow();
    expect(STYLE_PROPERTIES).toHaveLength(8);
    expect(STYLE_PROPERTIES[0]).toBe('color');
  });
});

describe('draft', () => {
  it('decodes a draft and strips unknown keys', () => {
    const out = Schema.decodeUnknownSync(NoteDraft)({ ...draft, id: 'leak' });
    expect('id' in out).toBe(false);
  });
  it('fails on missing target', () => {
    const rest = { ...draft, target: undefined };
    expect(() => Schema.decodeUnknownSync(NoteDraft)(rest)).toThrow();
  });
  it('NotePatch is all-optional', () => {
    expect(Schema.decodeUnknownSync(NotePatch)({})).toEqual({});
    expect(Schema.decodeUnknownSync(NotePatch)({ label: 'x', forceApply: true }).label).toBe('x');
    expect(() => Schema.decodeUnknownSync(NotePatch)({ comment: 1 })).toThrow();
  });
});

describe('errors', () => {
  it('carries context fields and tags', () => {
    const tab = Schema.decodeSync(TabId)(3);
    expect(new errors.StorageQuotaExceeded({ bytesInUse: 5 })._tag).toBe('StorageQuotaExceeded');
    expect(new errors.StorageCorrupt({ key: 'k', issue: 'i' }).key).toBe('k');
    expect(new errors.StorageUnavailable({ cause: 1 }).cause).toBe(1);
    expect(new errors.ShotStoreError({ op: 'get', cause: 1 }).op).toBe('get');
    expect(new errors.UnsupportedPage({ url: 'u' }).url).toBe('u');
    expect(new errors.PermissionDenied({ origin: 'o' }).origin).toBe('o');
    expect(new errors.InjectionFailed({ tabId: tab, cause: 1 }).tabId).toBe(3);
    expect(new errors.CaptureFailed({ reason: 'r' }).reason).toBe('r');
    expect(new errors.ElementNotFound({ noteId: Schema.decodeSync(NoteId)(noteId) }).noteId).toBe(noteId);
    expect(new errors.ClipboardDenied({ cause: 1 })._tag).toBe('ClipboardDenied');
    expect(new errors.MessageTimeout({ type: 't', ms: 1 }).ms).toBe(1);
    expect(new errors.MessageDecodeError({ type: 't', issue: 'i' }).issue).toBe('i');
    expect(new errors.InvariantViolation({ what: 'w' }).what).toBe('w');
    expect(new errors.NoteSaveError({ reason: 'r' })._tag).toBe('NoteSaveError');
  });
});
