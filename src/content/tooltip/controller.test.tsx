import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Effect, Exit, Option, Scope } from 'effect';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copy } from '../../copy';
import { defaultSettings, emptyEdits, type Note } from '../../domain';
import { RemoteFailure, type MessengerService } from '../../messaging';
import { note as baseNote } from '../../messaging/fixtures';
import { SessionStore, SessionStoreMemory, type SessionKvService } from '../../storage';
import { buildTarget } from '../../locator';
import { makeEditRegistry } from '../edit';
import { openSession, type TooltipHandle } from './controller';
import { draftKey } from './model/draft';

const t = copy.tooltip;
const flush = () => new Promise((r) => setTimeout(r, 0));

const makeKv = (): SessionKvService =>
  Effect.runSync(
    Effect.gen(function* () {
      return yield* SessionStore;
    }).pipe(Effect.provide(SessionStoreMemory())),
  );

interface Rig {
  readonly el: HTMLElement;
  readonly handle: TooltipHandle;
  readonly toBackground: ReturnType<typeof vi.fn>;
  readonly registry: ReturnType<typeof makeEditRegistry>;
  readonly kv: SessionKvService;
  readonly scope: Scope.CloseableScope;
}

const shadow = () => {
  const host = document.querySelector('figval-root');
  return (host?.shadowRoot ?? null) as unknown as HTMLElement | null;
};
const ui = () => within(shadow() as HTMLElement);

interface RigOptions {
  readonly mode?: 'new' | 'reopen';
  readonly reply?: Effect.Effect<Note, RemoteFailure>;
  readonly settings?: Partial<typeof defaultSettings>;
  readonly kv?: SessionKvService;
}

const savedNote = (el: Element, edits = emptyEdits): Note => ({
  ...baseNote,
  target: buildTarget(el),
  comment: 'saved',
  edits,
});

const open = async (o: RigOptions = {}): Promise<Rig> => {
  document.body.innerHTML =
    '<button id="cta" class="btn">Start</button><button class="btn">Other</button>';
  const el = document.getElementById('cta') as HTMLElement;
  const kv = o.kv ?? makeKv();
  const stored = savedNote(el);
  const toBackground = vi.fn(() => o.reply ?? Effect.succeed(stored));
  const registry = makeEditRegistry(document);
  // A user who has seen the first-note hint, so message counts stay about the note itself.
  const settings = { ...defaultSettings, activeSessionId: baseNote.sessionId, tooltipHintSeen: true, ...o.settings };
  const scope = Effect.runSync(Scope.make());
  const handle = await Effect.runPromise(
    openSession({
      deps: {
        messenger: { toBackground } as unknown as MessengerService,
        sessionStore: kv,
        settings: { get: Effect.succeed(settings) } as never,
        sessions: { get: () => Effect.succeed(Option.none()) } as never,
        notes: { get: () => Effect.succeed(Option.some(stored)) } as never,
      },
      target: buildTarget(el),
      opts: {
        mode: o.mode ?? 'new',
        ...(o.mode === 'reopen' ? { noteId: stored.id } : {}),
        anchor: el,
        registry,
      },
      resolveAsset: (p) => p,
      scope,
    }).pipe(Scope.extend(scope)),
  );
  if (!handle) throw new Error('tooltip did not open');
  return { el, handle, toBackground, registry, kv, scope };
};

const openWithKv = (kv: SessionKvService): Promise<Rig> => open({ kv });

let rig: Rig | null = null;
beforeEach(() => {
  rig = null;
});
afterEach(async () => {
  if (rig) await Effect.runPromise(rig.handle.cancel);
  document.body.innerHTML = '';
});

describe('tooltip session', () => {
  it('mounts a dialog inside a shadow root with the provisional id', async () => {
    rig = await open();
    expect(ui().getByRole('dialog', { name: 'FV-1' })).toBeInTheDocument();
    expect(document.querySelector('figval-root')).not.toBeNull();
  });

  it('opens the Edit tab for developers who used it last', async () => {
    rig = await open({ settings: { preset: 'developer', lastTooltipTab: 'edit' } });
    expect(ui().getByRole('tab', { name: t.tabs.edit })).toHaveAttribute('aria-selected', 'true');
  });

  it('saves a comment with the element rect and closes', async () => {
    rig = await open();
    await userEvent.type(ui().getByPlaceholderText(t.comment.placeholder), 'Bigger');
    await userEvent.click(ui().getByRole('button', { name: new RegExp(t.actions.save) }));
    await waitFor(() => expect(shadow()).toBeNull());
    const [req] = rig.toBackground.mock.calls[0] as unknown as [
      { _tag: string; draft: { comment: string }; rect: object },
    ];
    expect(req._tag).toBe('NoteCreate');
    expect(req.draft.comment).toBe('Bigger');
    expect(req.rect).toHaveProperty('w');
  });

  it('previews edits live and reverts them on Cancel', async () => {
    rig = await open({ settings: { preset: 'developer', lastTooltipTab: 'edit' } });
    await userEvent.click(ui().getByRole('checkbox', { name: t.edit.controls.hide }));
    expect(rig.el.style.display).toBe('none');
    await userEvent.click(ui().getByRole('button', { name: new RegExp(t.actions.cancel) }));
    await flush();
    expect(rig.el.style.display).toBe('');
    expect(shadow()).toBeNull();
  });

  it('ignores Cancel and Esc while a save is in flight and saves the note once', async () => {
    let release: (note: Note) => void = () => undefined;
    const pending = Effect.async<Note, RemoteFailure>((resume) => {
      release = (n) => resume(Effect.succeed(n));
    });
    rig = await open({ settings: { preset: 'developer', lastTooltipTab: 'edit' }, reply: pending });
    await userEvent.click(ui().getByRole('checkbox', { name: t.edit.controls.hide }));
    await userEvent.click(ui().getByRole('button', { name: new RegExp(t.actions.save) }));
    await userEvent.click(ui().getByRole('button', { name: new RegExp(t.actions.cancel) }));
    await userEvent.keyboard('{Escape}');
    await flush();
    expect(shadow()).not.toBeNull();
    expect(rig.el.style.display).toBe('none');
    release(savedNote(rig.el, { ...emptyEdits, hidden: true }));
    await waitFor(() => expect(shadow()).toBeNull());
    expect(rig.toBackground).toHaveBeenCalledTimes(1);
    expect(rig.el.style.display).toBe('none');
  });

  it('keeps edits visible through the registry after Save', async () => {
    const edits = { ...emptyEdits, hidden: true };
    rig = await open({ settings: { preset: 'developer', lastTooltipTab: 'edit' } });
    rig.toBackground.mockReturnValue(Effect.succeed(savedNote(rig.el, edits)));
    await userEvent.click(ui().getByRole('checkbox', { name: t.edit.controls.hide }));
    await userEvent.click(ui().getByRole('button', { name: new RegExp(t.actions.save) }));
    await waitFor(() => expect(shadow()).toBeNull());
    expect(rig.el.style.display).toBe('none');
    expect(rig.registry.entries()).toHaveLength(1);
  });

  it('asks before discarding and closes on the second Esc', async () => {
    rig = await open();
    await userEvent.type(ui().getByPlaceholderText(t.comment.placeholder), 'draft');
    await userEvent.keyboard('{Escape}');
    expect(await ui().findByText(t.status.discardConfirm)).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(shadow()).toBeNull());
  });

  it('closes on the first Esc when nothing was entered', async () => {
    rig = await open();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(shadow()).toBeNull());
  });

  it('does not close when the page is clicked', async () => {
    rig = await open();
    await userEvent.click(document.body);
    expect(shadow()).not.toBeNull();
  });

  it('stays open with content and shows the quota error on save failure', async () => {
    rig = await open({
      reply: Effect.fail(new RemoteFailure({ tag: 'StorageQuotaExceeded' })),
    });
    await userEvent.type(ui().getByPlaceholderText(t.comment.placeholder), 'keep');
    await userEvent.click(ui().getByRole('button', { name: new RegExp(t.actions.save) }));
    expect(await ui().findByRole('alert')).toHaveTextContent(copy.errors.StorageQuotaExceeded);
    expect(ui().getByPlaceholderText(t.comment.placeholder)).toHaveValue('keep');
  });

  it('tells the background which tab was used last', async () => {
    rig = await open();
    await userEvent.click(ui().getByRole('tab', { name: t.tabs.edit }));
    expect(rig.toBackground).toHaveBeenCalledWith({
      _tag: 'SettingsUpdate',
      patch: { lastTooltipTab: 'edit' },
    });
  });

  it('starts a new note with the last force-apply choice', async () => {
    rig = await open({ settings: { lastForceApply: true } });
    expect(ui().getByRole('checkbox', { name: t.comment.forceApply })).toBeChecked();
  });

  it('remembers the force-apply choice for the next note', async () => {
    rig = await open();
    await userEvent.click(ui().getByRole('checkbox', { name: t.comment.forceApply }));
    expect(rig.toBackground).toHaveBeenCalledWith({
      _tag: 'SettingsUpdate',
      patch: { lastForceApply: true },
    });
  });

  it('keeps a reopened note at its own force-apply value', async () => {
    rig = await open({ mode: 'reopen', settings: { lastForceApply: true } });
    expect(ui().getByRole('checkbox', { name: t.comment.forceApply })).not.toBeChecked();
  });

  it('shows the first-note hint once and remembers it was seen', async () => {
    rig = await open({ settings: { tooltipHintSeen: false } });
    expect(ui().getByRole('note')).toHaveTextContent(t.hint.body);
    expect(rig.toBackground).toHaveBeenCalledWith({ _tag: 'SettingsUpdate', patch: { tooltipHintSeen: true } });
  });

  it('skips the hint once it was seen', async () => {
    rig = await open({ settings: { tooltipHintSeen: true } });
    expect(ui().queryByRole('note')).toBeNull();
  });

  it('skips the hint when reopening a saved note', async () => {
    rig = await open({ mode: 'reopen', settings: { tooltipHintSeen: false } });
    expect(ui().queryByRole('note')).toBeNull();
  });

  it('prefills and sends NoteUpdate when reopening', async () => {
    rig = await open({ mode: 'reopen' });
    const box = ui().getByPlaceholderText(t.comment.placeholder);
    expect(box).toHaveValue('saved');
    await userEvent.type(box, '!');
    await userEvent.click(ui().getByRole('button', { name: new RegExp(t.actions.save) }));
    await waitFor(() => expect(shadow()).toBeNull());
    const [req] = rig.toBackground.mock.calls[0] as unknown as [
      { _tag: string; patch: { comment: string } },
    ];
    expect(req._tag).toBe('NoteUpdate');
    expect(req.patch.comment).toBe('saved!');
  });

  it('persists a draft and offers to resume it on the next open', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    rig = await open();
    await userEvent.type(ui().getByPlaceholderText(t.comment.placeholder), 'half done');
    await vi.advanceTimersByTimeAsync(500);
    vi.useRealTimers();
    const stored = await Effect.runPromise(rig.kv.get(draftKey(window.location.href)));
    expect(stored).toMatchObject({ snapshot: { comment: 'half done' } });
    const kv = rig.kv;
    await Effect.runPromise(Scope.close(rig.scope, Exit.void));
    rig = null;
    document.body.innerHTML = '';
    // Closing through the scope keeps the draft; reopening on the same element offers it.
    const again = await openWithKv(kv);
    expect(await ui().findByText(t.draft.resume('FV-1'))).toBeInTheDocument();
    await userEvent.click(ui().getByRole('button', { name: t.draft.resumeAction }));
    expect(ui().getByPlaceholderText(t.comment.placeholder)).toHaveValue('half done');
    rig = again;
  });

  it('re-applies edits and says so when the page re-renders the element', async () => {
    rig = await open({ settings: { preset: 'developer', lastTooltipTab: 'edit' } });
    await userEvent.click(ui().getByRole('checkbox', { name: t.edit.controls.hide }));
    const fresh = document.createElement('button');
    fresh.id = 'cta';
    fresh.className = 'btn';
    fresh.textContent = 'Start';
    rig.el.replaceWith(fresh);
    expect(await ui().findByText(t.status.reapplied)).toBeInTheDocument();
    expect(fresh.style.display).toBe('none');
  });

  it('disables Edit and keeps comment saving when the element disappears', async () => {
    rig = await open({ settings: { preset: 'developer', lastTooltipTab: 'edit' } });
    rig.el.remove();
    expect(await ui().findByText(t.status.elementGone)).toBeInTheDocument();
    expect(ui().getByRole('tab', { name: t.tabs.edit })).toBeDisabled();
    await userEvent.type(ui().getByPlaceholderText(t.comment.placeholder), 'still here');
    expect(ui().getByRole('button', { name: new RegExp(t.actions.save) })).toBeEnabled();
  });

  void screen;
});
