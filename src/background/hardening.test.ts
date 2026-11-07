import { Effect } from 'effect';
import { afterEach, describe, expect, it } from 'vitest';
import { Messenger, type BackgroundRequest } from '../messaging';
import { TestDriver, TestRecorder } from '../platform';
import { NoteRepo, SessionRepo, SessionStore, SettingsRepo } from '../storage';
import { activationKey, missingKey } from './keys';
import { program } from './main';
import { draftOf, makeHarness, tab, tabIdOf } from './test-harness';
import { Duration } from 'effect';

let h = makeHarness();
afterEach(() => h.runtime.dispose());
const fresh = (options?: Parameters<typeof makeHarness>[0]) => {
  h = makeHarness(options);
  return h;
};
const send = <R extends BackgroundRequest>(req: R) =>
  h.run(Effect.flatMap(Messenger, (m) => m.toBackground(req)));
const create = (n?: number) =>
  send({ _tag: 'NoteCreate', draft: draftOf(), ...(n === undefined ? {} : { tabId: tabIdOf(n) }) });
const sessions = () => h.run(Effect.flatMap(SessionRepo, (r) => r.list));
const settle = Effect.sleep(Duration.millis(40));

describe('F1 single writer', () => {
  it('serialises concurrent NoteCreate: seq 1 and 2, both in noteOrder', async () => {
    fresh();
    const notes = await Promise.all([create(1), create(1), create(1)]);
    const { items } = await sessions();
    expect(items).toHaveLength(1);
    expect(notes.map((n) => n.seq).sort()).toEqual([1, 2, 3]);
    expect([...(items[0]?.noteOrder ?? [])].sort()).toEqual(notes.map((n) => n.id).sort());
    expect(items[0]?.nextSeq).toBe(4);
  });

  it('applies concurrent SettingsUpdate patches both', async () => {
    fresh();
    await Promise.all([
      send({ _tag: 'SettingsUpdate', patch: { preset: 'reviewer' } }),
      send({ _tag: 'SettingsUpdate', patch: { screenshots: false } }),
    ]);
    const settings = await h.run(Effect.flatMap(SettingsRepo, (r) => r.get));
    expect(settings.screenshots).toBe(false);
    expect(settings.preset).toBe('reviewer');
  });
});

describe('F3 sender tab', () => {
  it('captures the sender tab when the message names none', async () => {
    fresh({
      senderTabId: 2,
      platform: { tabs: [tab(1), tab(2, 'https://example.com/page')], activeTabId: tabIdOf(1) },
    });
    await create();
    const calls = await h.run(Effect.flatMap(TestRecorder, (r) => r.calls));
    const visible = calls.find((c) => c.op === 'visibleTab');
    expect(h.contentCalls).toEqual(['UiHide', 'UiShow']);
    expect(visible).toBeDefined();
  });

  it('MissingReport falls back to the sender tab before the active tab', async () => {
    fresh({ senderTabId: 2, platform: { tabs: [tab(1), tab(2)], activeTabId: tabIdOf(1) } });
    await send({ _tag: 'MissingReport', ids: [] });
    const store = (key: string) => h.run(Effect.flatMap(SessionStore, (s) => s.get(key)));
    expect(await store(missingKey(tabIdOf(2)))).toEqual([]);
    expect(await store(missingKey(tabIdOf(1)))).toBeUndefined();
  });
});

describe('F4 reload re-injection', () => {
  const injectsOnComplete = (alive: boolean, navigateTo?: string) => {
    fresh({ contentAlive: alive });
    const id = tabIdOf(1);
    return h.run(
      Effect.gen(function* () {
        const driver = yield* TestDriver;
        const recorder = yield* TestRecorder;
        const injects = Effect.map(
          recorder.calls,
          (c) => c.filter((x) => x.op === 'injectContent').length,
        );
        yield* Effect.forkDaemon(program);
        yield* settle;
        yield* driver.clickAction(id);
        yield* settle;
        const before = yield* injects;
        if (navigateTo !== undefined) yield* driver.navigate(id, navigateTo);
        yield* driver.emitUpdate({ tabId: id, status: 'complete' });
        yield* settle;
        return (yield* injects) - before;
      }),
    );
  };

  it('re-injects an active same-origin tab on complete, without PickerStart', async () => {
    fresh({ contentAlive: false });
    const id = tabIdOf(1);
    await h.run(
      Effect.gen(function* () {
        const store = yield* SessionStore;
        yield* store.set(activationKey(id), {
          tabId: id,
          origin: 'https://example.com',
          active: true,
        });
        yield* Effect.forkDaemon(program);
        yield* settle;
        yield* (yield* TestDriver).emitUpdate({ tabId: id, status: 'complete' });
        yield* settle;
      }),
    );
    const calls = await h.run(Effect.flatMap(TestRecorder, (r) => r.calls));
    expect(calls.filter((c) => c.op === 'injectContent').length).toBeGreaterThan(0);
    expect(h.contentCalls).not.toContain('PickerStart');
  });

  it('does nothing for a tab that was never activated', async () => {
    fresh({ contentAlive: false });
    await h.run(
      Effect.gen(function* () {
        yield* Effect.forkDaemon(program);
        yield* settle;
        yield* (yield* TestDriver).emitUpdate({ tabId: tabIdOf(1), status: 'complete' });
        yield* settle;
      }),
    );
    const calls = await h.run(Effect.flatMap(TestRecorder, (r) => r.calls));
    expect(calls.filter((c) => c.op === 'injectContent')).toHaveLength(0);
  });

  it('keeps ping-only when the content script is alive; skips another origin', async () => {
    expect(await injectsOnComplete(true)).toBe(0);
    expect(await injectsOnComplete(false, 'https://other.org/')).toBe(0);
  });
});

describe('F6 compensation', () => {
  it('removes the inserted note and its shots when the session write fails', async () => {
    fresh();
    await create(1);
    h.breakWrites.sessionReplace = true;
    const exit = await h.run(
      Effect.exit(
        Effect.flatMap(Messenger, (m) =>
          m.toBackground({ _tag: 'NoteCreate', draft: draftOf(), tabId: tabIdOf(1) }),
        ),
      ),
    );
    expect(exit._tag).toBe('Failure');
    h.breakWrites.sessionReplace = false;
    const { items } = await sessions();
    const listed = await h.run(Effect.flatMap(NoteRepo, (r) => r.list(items[0]!.id)));
    expect(listed.items).toHaveLength(1);
    expect(h.shotLive.size).toBe(1);
  });

  it('removes a freshly inserted session when the settings write fails', async () => {
    fresh();
    h.breakWrites.settingsPut = true;
    const exit = await h.run(
      Effect.exit(
        Effect.flatMap(Messenger, (m) => m.toBackground({ _tag: 'NoteCreate', draft: draftOf() })),
      ),
    );
    expect(exit._tag).toBe('Failure');
    expect((await sessions()).items).toHaveLength(0);
    const second = await h.run(
      Effect.exit(
        Effect.flatMap(Messenger, (m) => m.toBackground({ _tag: 'SessionCreate', name: 'x' })),
      ),
    );
    expect(second._tag).toBe('Failure');
    expect((await sessions()).items).toHaveLength(0);
  });
});
