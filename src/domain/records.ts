import { Schema } from 'effect';
import { NoteId, NoteSeq, SessionId, ShotId } from './ids';

export const STYLE_PROPERTIES = [
  'color',
  'background-color',
  'font-size',
  'font-weight',
  'padding-block',
  'padding-inline',
  'border-radius',
  'text-align',
] as const;

export const StyleProperty = Schema.Literal(...STYLE_PROPERTIES);
export type StyleProperty = typeof StyleProperty.Type;

export const Preset = Schema.Literal('developer', 'reviewer');
export type Preset = typeof Preset.Type;

export const TooltipTab = Schema.Literal('comment', 'edit');
export type TooltipTab = typeof TooltipTab.Type;

export const Settings = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  preset: Preset,
  screenshots: Schema.Boolean,
  activeSessionId: Schema.NullOr(SessionId),
  lastTooltipTab: TooltipTab,
  /** Default for "Let the agent apply this" on the next new note; older saves lack it. */
  lastForceApply: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  /** Onboarding checklist: set by the first copy or download; older saves lack it. */
  exportedOnce: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  /** Onboarding checklist closed by the user. */
  checklistDismissed: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  /** First-tooltip shortcut hint closed or seen once. */
  tooltipHintSeen: Schema.optionalWith(Schema.Boolean, { default: () => false }),
});
export type Settings = typeof Settings.Type;

export const defaultSettings: Settings = {
  schemaVersion: 1,
  preset: 'reviewer',
  screenshots: true,
  activeSessionId: null,
  lastTooltipTab: 'comment',
  lastForceApply: false,
  exportedOnce: false,
  checklistDismissed: false,
  tooltipHintSeen: false,
};

export const Session = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  id: SessionId,
  name: Schema.String,
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
  nextSeq: NoteSeq,
  noteOrder: Schema.Array(NoteId),
});
export type Session = typeof Session.Type;

export const DomStep = Schema.Struct({
  tag: Schema.String,
  id: Schema.optional(Schema.String),
  classes: Schema.Array(Schema.String),
  nth: Schema.optional(Schema.Number),
  testid: Schema.optional(Schema.String),
});
export type DomStep = typeof DomStep.Type;

export const TargetAttrs = Schema.Struct({
  id: Schema.optional(Schema.String),
  testid: Schema.optional(Schema.String),
  ariaLabel: Schema.optional(Schema.String),
  role: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
});
export type TargetAttrs = typeof TargetAttrs.Type;

export const Selection = Schema.Struct({
  text: Schema.String,
  before: Schema.String,
  after: Schema.String,
});
export type Selection = typeof Selection.Type;

export const Target = Schema.Struct({
  kind: Schema.Literal('element', 'text'),
  label: Schema.String,
  text: Schema.String,
  attrs: TargetAttrs,
  classes: Schema.Array(Schema.String),
  domPath: Schema.Array(DomStep).pipe(Schema.maxItems(6)),
  selector: Schema.String,
  html: Schema.String,
  selection: Schema.NullOr(Selection),
  state: Schema.Literal('rest', 'hover', 'focus'),
});
export type Target = typeof Target.Type;

export const StyleChange = Schema.Struct({
  property: StyleProperty,
  before: Schema.String,
  after: Schema.String,
});
export type StyleChange = typeof StyleChange.Type;

export const TextEdit = Schema.Struct({ before: Schema.String, after: Schema.String });
export type TextEdit = typeof TextEdit.Type;

export const Edits = Schema.Struct({
  text: Schema.NullOr(TextEdit),
  style: Schema.Array(StyleChange),
  hidden: Schema.Boolean,
  scope: Schema.Literal('this', 'similar'),
  similarSelector: Schema.NullOr(Schema.String),
  similarCount: Schema.Number,
});
export type Edits = typeof Edits.Type;

export const emptyEdits: Edits = {
  text: null,
  style: [],
  hidden: false,
  scope: 'this',
  similarSelector: null,
  similarCount: 0,
};

export const Viewport = Schema.Struct({ w: Schema.Number, h: Schema.Number });
export type Viewport = typeof Viewport.Type;

export const PageInfo = Schema.Struct({
  url: Schema.String,
  title: Schema.String,
  viewport: Viewport,
  dpr: Schema.Number,
});
export type PageInfo = typeof PageInfo.Type;

export const Shots = Schema.Struct({
  before: Schema.NullOr(ShotId),
  after: Schema.NullOr(ShotId),
});
export type Shots = typeof Shots.Type;

export const Note = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  id: NoteId,
  seq: NoteSeq,
  sessionId: SessionId,
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
  page: PageInfo,
  target: Target,
  comment: Schema.String,
  why: Schema.String,
  forceApply: Schema.Boolean,
  edits: Edits,
  shots: Shots,
});
export type Note = typeof Note.Type;
