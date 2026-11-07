import { Effect } from 'effect';
import { afterEach, describe, expect, it } from 'vitest';
import type { SessionId } from '../domain';
import { Messenger, type BackgroundRequest } from '../messaging';
import { TestRecorder } from '../platform';
import { SessionRepo, SessionStore, SettingsRepo, NoteRepo } from '../storage';
import { clearActivation, clearIfOriginChanged } from './activation';
import { handle } from './router';
import { activationKey, missingKey } from './keys';
import { draftOf, makeHarness, tab, tabIdOf, withTextEdit } from './test-harness';

let h = makeHarness();
afterEach(() => h.runtime.dispose());
const fresh = (options?: Parameters<typeof makeHarness>[0]) => {
  h = makeHarness(options);
  return h;
};
const send = <R extends BackgroundRequest>(req: R) =>
  h.run(Effect.flatMap(Messenger, (m) => m.toBackground(req)));
const fail = <R extends BackgroundRequest>(req: R) =>
  h.run(Effect.flip(Effect.flatMap(Messenger, (m) => m.toBackground(req))));
const stored = (key: string) => h.run(Effect.flatMap(SessionStore, (s) => s.get(key)));
const injectCalls = () =>
  h
    .run(Effect.flatMap(TestRecorder, (r) => r.calls))
    .then((c) => c.filter((x) => x.op === 'injectContent'));
const activate = (n: number, via: 'action' | 'command' | 'panel' = 'action') =>
  ({ _tag: 'ActivateTab', tabId: tabIdOf(n), via }) as const;

describe('Activation.ensure', () => {
  it('pings, then starts the picker, then stores the activation state', async () => {
    fresh();
    await send(activate(1));
    expect(h.contentCalls).toEqual(['Ping', 'PickerStart']);
    expect(await injectCalls()).toHaveLength(0);
    expect(await stored(activationKey(tabIdOf(1)))).toEqual({
      tabId: 1,
      origin: 'https://example.com',
      active: true,
    });
  });

  it('injects when the content script is not alive, for the panel path too', async () => {
    fresh({ contentAlive: false });
    await send(activate(1, 'panel'));
    expect((await injectCalls()).length).toBeGreaterThan(0);
  });

  it('rejects unsupported pages', async () => {
    fresh({ platform: { tabs: [tab(1, 'chrome://extensions')] } });
    expect(await fail(activate(1))).toMatchObject({ tag: 'UnsupportedPage' });
    expect(h.contentCalls).toEqual([]);
  });

  it('rejects unreadable tabs', async () => {
    fresh();
    expect(await fail(activate(42, 'command'))).toMatchObject({ tag: 'UnsupportedPage' });
  });

  it('retries injection once then escapes', async () => {
    fresh({
      contentAlive: false,
      platform: { scripting: { failing: [tabIdOf(1)] } },
    });
    expect(await fail(activate(1))).toMatchObject({ tag: 'InjectionFailed' });
    expect(await injectCalls()).toHaveLength(2);
  });

  it('clears the state on close and when the origin changes', async () => {
    fresh();
    await send(activate(1));
    await h.run(clearIfOriginChanged(tabIdOf(1), 'https://example.com/other'));
    expect(await stored(activationKey(tabIdOf(1)))).toBeDefined();
    await h.run(clearIfOriginChanged(tabIdOf(1), 'https://other.org/'));
    expect(await stored(activationKey(tabIdOf(1)))).toBeUndefined();
    await send(activate(1));
    await h.run(clearActivation(tabIdOf(1)));
    expect(await stored(activationKey(tabIdOf(1)))).toBeUndefined();
    await h.run(clearIfOriginChanged(tabIdOf(5), 'https://example.com/page'));
  });
});

describe('sessions and settings', () => {
  it('creates, renames, activates and updates settings', async () => {
    fresh();
    const created = await send({ _tag: 'SessionCreate' });
    expect(created.name).toBe('example.com · Nov 7');
    const named = await send({ _tag: 'SessionCreate', name: 'Second' });
    const settings = await h.run(Effect.flatMap(SettingsRepo, (r) => r.get));
    expect(settings.activeSessionId).toBe(named.id);
    const renamed = await send({ _tag: 'SessionRename', id: created.id, name: 'Renamed' });
    expect(renamed.name).toBe('Renamed');
    const activated = await send({ _tag: 'SessionActivate', id: created.id });
    expect(activated.activeSessionId).toBe(created.id);
    const updated = await send({ _tag: 'SettingsUpdate', patch: { preset: 'developer' } });
    expect(updated).toMatchObject({ preset: 'developer', activeSessionId: created.id });
  });

  it('names a session without any tab using an empty host', async () => {
    fresh({ platform: { tabs: [], activeTabId: null } });
    expect((await send({ _tag: 'SessionCreate' })).name).toBe(' · Nov 7');
  });

  it('fails on an unknown session', async () => {
    fresh();
    const id = 'fv-zzzz' as SessionId;
    expect(await fail({ _tag: 'SessionActivate', id })).toMatchObject({ tag: 'SessionNotFound' });
    expect(await fail({ _tag: 'SessionRename', id, name: 'x' })).toMatchObject({
      tag: 'SessionNotFound',
    });
  });

  it('reorders notes when the order is a permutation and rejects anything else', async () => {
    fresh();
    const a = await send({ _tag: 'NoteCreate', draft: draftOf(), tabId: tabIdOf(1) });
    const b = await send({ _tag: 'NoteCreate', draft: draftOf(), tabId: tabIdOf(1) });
    const id = a.sessionId;
    const reordered = await send({ _tag: 'SessionReorder', id, noteOrder: [b.id, a.id] });
    expect(reordered.noteOrder).toEqual([b.id, a.id]);
    const saved = await h.run(Effect.flatMap(SessionRepo, (r) => r.get(id)));
    expect(saved._tag === 'Some' && saved.value.noteOrder).toEqual([b.id, a.id]);
    for (const noteOrder of [
      [a.id],
      [a.id, a.id],
      [a.id, '00000000-0000-4000-8000-000000000000' as typeof a.id],
    ]) {
      expect(await fail({ _tag: 'SessionReorder', id, noteOrder })).toMatchObject({
        tag: 'InvalidOrder',
      });
    }
    expect(
      await fail({ _tag: 'SessionReorder', id: 'fv-zzzz' as SessionId, noteOrder: [] }),
    ).toMatchObject({ tag: 'SessionNotFound' });
  });

  it('deleting a session cascades notes and shots and moves the active pointer', async () => {
    fresh();
    const first = await send({ _tag: 'NoteCreate', draft: withTextEdit(), tabId: tabIdOf(1) });
    const other = await send({ _tag: 'SessionCreate', name: 'Other' });
    expect(h.shotLive.size).toBe(2);
    await send({ _tag: 'SessionDelete', id: other.id });
    let settings = await h.run(Effect.flatMap(SettingsRepo, (r) => r.get));
    expect(settings.activeSessionId).toBe(first.sessionId);
    await send({ _tag: 'SessionDelete', id: first.sessionId });
    settings = await h.run(Effect.flatMap(SettingsRepo, (r) => r.get));
    expect(settings.activeSessionId).toBeNull();
    expect(h.shotLive.size).toBe(0);
    const notes = await h.run(Effect.flatMap(NoteRepo, (r) => r.list(first.sessionId)));
    expect(notes.items).toHaveLength(0);
    expect((await h.run(Effect.flatMap(SessionRepo, (r) => r.list))).items).toHaveLength(0);
  });

  it('falls back to the most recent remaining session when the active one is deleted', async () => {
    fresh();
    const a = await send({ _tag: 'SessionCreate', name: 'A' });
    const b = await send({ _tag: 'SessionCreate', name: 'B' });
    await send({ _tag: 'SessionDelete', id: b.id });
    const settings = await h.run(Effect.flatMap(SettingsRepo, (r) => r.get));
    expect(settings.activeSessionId).toBe(a.id);
  });
});

describe('router', () => {
  it('stores missing ids for the named tab and for the active tab', async () => {
    fresh();
    const note = await send({ _tag: 'NoteCreate', draft: draftOf(), tabId: tabIdOf(1) });
    await send({ _tag: 'MissingReport', tabId: tabIdOf(3), ids: [note.id] });
    await send({ _tag: 'MissingReport', ids: [note.id] });
    expect(await stored(missingKey(tabIdOf(3)))).toEqual([note.id]);
    expect(await stored(missingKey(tabIdOf(1)))).toEqual([note.id]);
  });

  it('ignores a missing report when no tab is known', async () => {
    fresh({ platform: { tabs: [], activeTabId: null } });
    await send({ _tag: 'MissingReport', ids: [] });
    expect(await stored(missingKey(tabIdOf(1)))).toBeUndefined();
  });

  it('dies with InvariantViolation on a content-only tag', async () => {
    fresh();
    const exit = await h.run(Effect.exit(handle({ _tag: 'PickerStart' })));
    expect(exit._tag).toBe('Failure');
    expect(JSON.stringify(exit)).toContain('InvariantViolation');
  });

  it('passes non-note errors through by tag', async () => {
    fresh();
    h.fault.set({ kind: 'unavailable' });
    expect(await fail({ _tag: 'SettingsUpdate', patch: {} })).toMatchObject({
      tag: 'StorageUnavailable',
    });
    h.fault.set(null);
  });
});
