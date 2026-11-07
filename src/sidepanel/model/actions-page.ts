import { Effect } from 'effect';
import { UnsupportedPage, type NoteId, type TabId } from '../../domain';
import { Messenger, type MessengerService, type MessagingError } from '../../messaging';
import { Permissions } from '../../platform';
import {
  clearError,
  failTo,
  getState,
  toErrorTag,
  update,
  type Ctx,
  type PanelEnv,
} from './context';
import { withUi, withoutErrors, type ActivationState, type BeforeAfter, type ErrorKey } from './state';

const originOf = (url: string): string | null => {
  if (!URL.canParse(url)) return null;
  const { origin } = new URL(url);
  return origin === 'null' ? null : origin;
};

const activationFailure = (activation: ActivationState, tag: string): ActivationState => {
  if (tag === 'PermissionDenied') return { ...activation, permissionDenied: true, injectionFailed: false };
  if (tag === 'UnsupportedPage') return { ...activation, unsupported: true };
  if (tag === 'InjectionFailed') return { ...activation, injectionFailed: true, permissionDenied: false };
  return activation;
};

const ACTIVATION_TAGS: ReadonlySet<string> = new Set(['PermissionDenied', 'UnsupportedPage', 'InjectionFailed']);

const onActivationFailure =
  (ctx: Ctx, key: ErrorKey) =>
  (e: unknown): Effect.Effect<void> => {
    const tag = toErrorTag(e);
    return ACTIVATION_TAGS.has(tag)
      ? update(ctx, (s) => ({ ...s, activation: activationFailure(s.activation, tag) }))
      : failTo(ctx, key)(e);
  };

/**
 * Pick and Show share one path (p.impl.md §9): Permissions.ensureOrigin first, so the call starts
 * inside the click's user gesture, then ActivateTab{via:'panel'}.
 */
const activate = (ctx: Ctx, key: 'pick' | 'showNotes'): Effect.Effect<void, never, PanelEnv> =>
  Effect.gen(function* () {
    const { activeTab, activation } = yield* getState(ctx);
    if (activeTab === null || activation.unsupported) return;
    const origin = originOf(activeTab.url);
    if (origin === null) return yield* new UnsupportedPage({ url: activeTab.url });
    const permissions = yield* Permissions;
    yield* permissions.ensureOrigin(origin);
    const messenger = yield* Messenger;
    yield* messenger.toBackground({ _tag: 'ActivateTab', tabId: activeTab.id, via: 'panel' });
    yield* update(ctx, (s) => ({
      ...withoutErrors(s, ['pick', 'showNotes']),
      activation: { ...s.activation, permissionDenied: false, injectionFailed: false },
    }));
  }).pipe(Effect.catchAll(onActivationFailure(ctx, key)));

export const pick = (ctx: Ctx) => activate(ctx, 'pick');
export const showNotes = (ctx: Ctx) => activate(ctx, 'showNotes');

const toActiveContent = (
  ctx: Ctx,
  key: ErrorKey,
  send: (tabId: TabId, m: MessengerService) => Effect.Effect<unknown, MessagingError>,
  options: { readonly onlyWhenActive: boolean },
): Effect.Effect<void, never, Messenger> =>
  Effect.gen(function* () {
    const { activeTab, activation } = yield* getState(ctx);
    if (activeTab === null || (options.onlyWhenActive && !activation.active)) return;
    const messenger = yield* Messenger;
    yield* send(activeTab.id, messenger);
    yield* clearError(ctx, key);
  }).pipe(Effect.catchAll(failTo(ctx, key)));

export const hover = (ctx: Ctx, noteId: NoteId | null) =>
  update(ctx, (s) => ({ ...s, hoverNoteId: noteId })).pipe(
    Effect.zipRight(
      toActiveContent(ctx, 'scroll', (tab, m) => m.toContent(tab, { _tag: 'Highlight', noteId }), {
        onlyWhenActive: true,
      }),
    ),
  );

export const open = (ctx: Ctx, noteId: NoteId) =>
  update(ctx, (s) => withUi(s, { view: 'detail', detailId: noteId })).pipe(
    Effect.zipRight(
      toActiveContent(ctx, 'scroll', (tab, m) => m.toContent(tab, { _tag: 'ScrollTo', noteId }), {
        onlyWhenActive: true,
      }),
    ),
  );

export const editOnPage = (ctx: Ctx, noteId: NoteId) =>
  toActiveContent(ctx, 'edit', (tab, m) => m.toContent(tab, { _tag: 'TooltipReopen', noteId }), {
    onlyWhenActive: true,
  });

/** Optimistic: the toggle flips at once and snaps back if the page did not follow. */
export const setBeforeAfter = (ctx: Ctx, next: BeforeAfter) =>
  Effect.gen(function* () {
    const prev = (yield* getState(ctx)).ui.beforeAfter;
    yield* clearError(ctx, 'beforeAfter');
    yield* update(ctx, (s) => withUi(s, { beforeAfter: next }));
    yield* toActiveContent(
      ctx,
      'beforeAfter',
      (tab, m) => m.toContent(tab, { _tag: next === 'before' ? 'EditsOff' : 'EditsOn' }),
      { onlyWhenActive: true },
    );
    const failed = (yield* getState(ctx)).ui.errors.beforeAfter !== undefined;
    if (failed) yield* update(ctx, (s) => withUi(s, { beforeAfter: prev }));
  });
