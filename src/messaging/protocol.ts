import { Schema } from 'effect';
import { Note, NoteDraft, NoteId, NotePatch, Preset, Session, SessionId, Settings, TabId, TooltipTab } from '../domain';

/** Void replies cross the wire as `null` (JSON drops `undefined`). */
const VoidReply = Schema.transform(Schema.Null, Schema.Void, {
  strict: true,
  decode: () => undefined,
  encode: () => null,
});

export const SettingsPatch = Schema.partial(
  Schema.Struct({
    preset: Preset,
    screenshots: Schema.Boolean,
    activeSessionId: Schema.NullOr(SessionId),
    lastTooltipTab: TooltipTab,
    lastForceApply: Schema.Boolean,
    exportedOnce: Schema.Boolean,
    checklistDismissed: Schema.Boolean,
    tooltipHintSeen: Schema.Boolean,
  }),
);
export type SettingsPatch = typeof SettingsPatch.Type;

export const ActivateVia = Schema.Literal('action', 'command', 'panel');
export type ActivateVia = typeof ActivateVia.Type;

const tagged = Schema.TaggedStruct;

export const PickerStart = tagged('PickerStart', {});
export const PickerStop = tagged('PickerStop', {});
export const Ping = tagged('Ping', {});
export const UiHide = tagged('UiHide', {});
export const UiShow = tagged('UiShow', {});
export const EditsOff = tagged('EditsOff', {});
export const EditsOn = tagged('EditsOn', {});
export const MarkersRender = tagged('MarkersRender', {
  notes: Schema.Array(Note),
  highlightId: Schema.optional(NoteId),
});
export const MarkersClear = tagged('MarkersClear', {});
export const Highlight = tagged('Highlight', { noteId: Schema.NullOr(NoteId) });
export const ScrollTo = tagged('ScrollTo', { noteId: NoteId });
export const TooltipReopen = tagged('TooltipReopen', { noteId: NoteId });
/** CSS px, viewport-relative, of the element at save time. */
const NoteRect = Schema.Struct({ x: Schema.Number, y: Schema.Number, w: Schema.Number, h: Schema.Number });

export const NoteCreate = tagged('NoteCreate', {
  draft: NoteDraft,
  rect: Schema.optional(NoteRect),
  tabId: Schema.optional(TabId),
});
export const NoteUpdate = tagged('NoteUpdate', { id: NoteId, patch: NotePatch });
export const NoteDelete = tagged('NoteDelete', { id: NoteId });
export const SessionCreate = tagged('SessionCreate', { name: Schema.optional(Schema.String) });
export const SessionRename = tagged('SessionRename', { id: SessionId, name: Schema.String });
export const SessionReorder = tagged('SessionReorder', {
  id: SessionId,
  noteOrder: Schema.Array(NoteId),
});
export const SessionDelete = tagged('SessionDelete', { id: SessionId });
export const SessionActivate = tagged('SessionActivate', { id: SessionId });
export const SettingsUpdate = tagged('SettingsUpdate', { patch: SettingsPatch });
export const MissingReport = tagged('MissingReport', {
  tabId: Schema.optional(TabId),
  ids: Schema.Array(NoteId),
});
export const ActivateTab = tagged('ActivateTab', { tabId: TabId, via: ActivateVia });

export const Request = Schema.Union(
  PickerStart,
  PickerStop,
  Ping,
  UiHide,
  UiShow,
  EditsOff,
  EditsOn,
  MarkersRender,
  MarkersClear,
  Highlight,
  ScrollTo,
  TooltipReopen,
  NoteCreate,
  NoteUpdate,
  NoteDelete,
  SessionCreate,
  SessionRename,
  SessionReorder,
  SessionDelete,
  SessionActivate,
  SettingsUpdate,
  MissingReport,
  ActivateTab,
);
export type Request = typeof Request.Type;
export type RequestTag = Request['_tag'];

/** Value schema of the reply to each request. */
export const replySchemas = {
  PickerStart: VoidReply,
  PickerStop: VoidReply,
  Ping: Schema.Struct({ pong: Schema.Literal(true) }),
  UiHide: VoidReply,
  UiShow: VoidReply,
  EditsOff: VoidReply,
  EditsOn: VoidReply,
  MarkersRender: VoidReply,
  MarkersClear: VoidReply,
  Highlight: VoidReply,
  ScrollTo: VoidReply,
  TooltipReopen: VoidReply,
  NoteCreate: Note,
  NoteUpdate: Note,
  NoteDelete: VoidReply,
  SessionCreate: Session,
  SessionRename: Session,
  SessionReorder: Session,
  SessionDelete: VoidReply,
  SessionActivate: Settings,
  SettingsUpdate: Settings,
  MissingReport: VoidReply,
  ActivateTab: VoidReply,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as const satisfies Record<RequestTag, Schema.Schema<any, any>>;

export type ReplyValue<R extends Request> = Schema.Schema.Type<(typeof replySchemas)[R['_tag']]>;

export const contentTags = [
  'PickerStart',
  'PickerStop',
  'Ping',
  'UiHide',
  'UiShow',
  'EditsOff',
  'EditsOn',
  'MarkersRender',
  'MarkersClear',
  'Highlight',
  'ScrollTo',
  'TooltipReopen',
] as const satisfies readonly RequestTag[];
export type ContentTag = (typeof contentTags)[number];
export type ContentRequest = Extract<Request, { readonly _tag: ContentTag }>;
export type BackgroundRequest = Exclude<Request, ContentRequest>;

export type Direction = 'toContent' | 'toBackground';

const contentTagSet: ReadonlySet<string> = new Set(contentTags);

export const directionOf = (tag: RequestTag): Direction =>
  contentTagSet.has(tag) ? 'toContent' : 'toBackground';

export const ReplyError = Schema.Struct({
  tag: Schema.String,
  message: Schema.optional(Schema.String),
});
export type ReplyError = typeof ReplyError.Type;

export type Reply<A> =
  | { readonly ok: true; readonly value: A }
  | { readonly ok: false; readonly error: ReplyError };

export const replyEnvelope = <A, I>(value: Schema.Schema<A, I>): Schema.Schema<Reply<A>, unknown> =>
  Schema.Union(
    Schema.Struct({ ok: Schema.Literal(true), value }),
    Schema.Struct({ ok: Schema.Literal(false), error: ReplyError }),
  ) as unknown as Schema.Schema<Reply<A>, unknown>;

export const replySchemaFor = (tag: RequestTag): Schema.Schema<unknown, unknown> =>
  replySchemas[tag] as Schema.Schema<unknown, unknown>;
