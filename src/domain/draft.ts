import { Schema } from 'effect';
import { Edits, PageInfo, Target } from './records';

/** What content sends to background on save; decoded at the content to background boundary. */
export const NoteDraft = Schema.Struct({
  page: PageInfo,
  target: Target,
  comment: Schema.String,
  why: Schema.String,
  forceApply: Schema.Boolean,
  edits: Edits,
});
export type NoteDraft = typeof NoteDraft.Type;

/** Partial update carried by NoteUpdate. */
export const NotePatch = Schema.Struct({
  comment: Schema.optional(Schema.String),
  why: Schema.optional(Schema.String),
  forceApply: Schema.optional(Schema.Boolean),
  edits: Schema.optional(Edits),
  label: Schema.optional(Schema.String),
});
export type NotePatch = typeof NotePatch.Type;
