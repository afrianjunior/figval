import { Option, Schema } from 'effect';
import { TooltipTab, type StyleProperty } from '../../../domain';
import type { TooltipState } from './state';

const Controls = Schema.Struct({
  text: Schema.NullOr(Schema.String),
  style: Schema.partial(
    Schema.Struct({
      color: Schema.String,
      'background-color': Schema.String,
      'font-size': Schema.String,
      'font-weight': Schema.String,
      'padding-block': Schema.String,
      'padding-inline': Schema.String,
      'border-radius': Schema.String,
      'text-align': Schema.String,
    }),
  ),
  hidden: Schema.Boolean,
  scope: Schema.Literal('this', 'similar'),
});

/** What the tooltip keeps in chrome.storage.session while a note is unsaved. */
export const DraftSnapshot = Schema.Struct({
  label: Schema.String,
  comment: Schema.String,
  why: Schema.String,
  showWhy: Schema.Boolean,
  forceApply: Schema.Boolean,
  tab: TooltipTab,
  ...Controls.fields,
});
export type DraftSnapshot = typeof DraftSnapshot.Type;

/** Stored form: the snapshot plus what is needed to offer "Resume draft FV-n?". */
export const StoredDraft = Schema.Struct({
  seq: Schema.Number,
  selector: Schema.String,
  snapshot: DraftSnapshot,
});
export type StoredDraft = typeof StoredDraft.Type;

export const decodeStoredDraft = (raw: unknown): Option.Option<StoredDraft> =>
  Schema.decodeUnknownOption(StoredDraft)(raw);

/** One draft per page: host + path, so a reload on the same page finds it. */
export const draftKey = (url: string): string => {
  if (!URL.canParse(url)) return `draft:${url}`;
  const { host, pathname } = new URL(url);
  return `draft:${host}${pathname}`;
};

export const toSnapshot = (state: TooltipState): DraftSnapshot => {
  const style: Partial<Record<StyleProperty, string>> = { ...state.controls.style };
  return {
    label: state.label,
    comment: state.comment,
    why: state.why,
    showWhy: state.showWhy,
    forceApply: state.forceApply,
    tab: state.tab,
    text: state.controls.text,
    style,
    hidden: state.controls.hidden,
    scope: state.controls.scope,
  };
};
