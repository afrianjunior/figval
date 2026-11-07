import { Schema } from 'effect';
import {
  defaultSettings,
  emptyEdits,
  makeNoteId,
  makeSessionId,
  makeShotId,
  type Note,
  type NoteDraft,
  type Session,
  TabId,
} from '../domain';
import type { Request, RequestTag } from './protocol';

const bytes = (seed: number) => (n: number) => Uint8Array.from({ length: n }, (_, i) => (seed * 31 + i) % 256);

export const noteId = (seed = 1) => makeNoteId(bytes(seed));
export const shotId = (seed = 1) => makeShotId(bytes(seed));
export const sessionId = makeSessionId(() => 0.1);
export const tabId = Schema.decodeSync(TabId)(7);

export const draft: NoteDraft = {
  page: { url: 'https://example.com/', title: 'Example', viewport: { w: 1440, h: 900 }, dpr: 2 },
  target: {
    kind: 'element',
    label: 'Hero CTA button',
    text: 'Start',
    attrs: { id: 'cta' },
    classes: ['btn'],
    domPath: [{ tag: 'button', classes: ['btn'] }],
    selector: '#cta',
    html: '<button id="cta">Start</button>',
    selection: null,
    state: 'rest',
  },
  comment: 'Make it bigger',
  why: '',
  forceApply: false,
  edits: emptyEdits,
};

export const note: Note = {
  schemaVersion: 1,
  id: noteId(1),
  seq: 1 as Note['seq'],
  sessionId,
  createdAt: 1,
  updatedAt: 2,
  page: draft.page,
  target: draft.target,
  comment: draft.comment,
  why: draft.why,
  forceApply: false,
  edits: emptyEdits,
  shots: { before: shotId(1), after: null },
};

export const session: Session = {
  schemaVersion: 1,
  id: sessionId,
  name: 'Session',
  createdAt: 1,
  updatedAt: 2,
  nextSeq: 2 as Session['nextSeq'],
  noteOrder: [note.id],
};

export const sampleRequests: { readonly [T in RequestTag]: Extract<Request, { _tag: T }> } = {
  PickerStart: { _tag: 'PickerStart' },
  PickerStop: { _tag: 'PickerStop' },
  Ping: { _tag: 'Ping' },
  UiHide: { _tag: 'UiHide' },
  UiShow: { _tag: 'UiShow' },
  EditsOff: { _tag: 'EditsOff' },
  EditsOn: { _tag: 'EditsOn' },
  MarkersRender: { _tag: 'MarkersRender', notes: [note], highlightId: note.id },
  MarkersClear: { _tag: 'MarkersClear' },
  Highlight: { _tag: 'Highlight', noteId: null },
  ScrollTo: { _tag: 'ScrollTo', noteId: note.id },
  TooltipReopen: { _tag: 'TooltipReopen', noteId: note.id },
  NoteCreate: { _tag: 'NoteCreate', draft, tabId, rect: { x: 10, y: 20, w: 120.5, h: 40 } },
  NoteUpdate: { _tag: 'NoteUpdate', id: note.id, patch: { comment: 'x', label: 'y' } },
  NoteDelete: { _tag: 'NoteDelete', id: note.id },
  SessionCreate: { _tag: 'SessionCreate', name: 'Review' },
  SessionRename: { _tag: 'SessionRename', id: sessionId, name: 'Renamed' },
  SessionReorder: { _tag: 'SessionReorder', id: sessionId, noteOrder: [note.id] },
  SessionDelete: { _tag: 'SessionDelete', id: sessionId },
  SessionActivate: { _tag: 'SessionActivate', id: sessionId },
  SettingsUpdate: { _tag: 'SettingsUpdate', patch: { preset: 'developer' } },
  MissingReport: { _tag: 'MissingReport', tabId, ids: [note.id] },
  ActivateTab: { _tag: 'ActivateTab', tabId, via: 'panel' },
};

/** A valid reply value for each request tag (decoded form). */
export const sampleReplyValues: { readonly [T in RequestTag]: unknown } = {
  PickerStart: undefined,
  PickerStop: undefined,
  Ping: { pong: true },
  UiHide: undefined,
  UiShow: undefined,
  EditsOff: undefined,
  EditsOn: undefined,
  MarkersRender: undefined,
  MarkersClear: undefined,
  Highlight: undefined,
  ScrollTo: undefined,
  TooltipReopen: undefined,
  NoteCreate: note,
  NoteUpdate: note,
  NoteDelete: undefined,
  SessionCreate: session,
  SessionRename: session,
  SessionReorder: session,
  SessionDelete: undefined,
  SessionActivate: defaultSettings,
  SettingsUpdate: defaultSettings,
  MissingReport: undefined,
  ActivateTab: undefined,
};
