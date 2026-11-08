import { Effect } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '../domain';
import { TestRecorder, type PlatformTestConfig } from '../platform';
import { makeHarness, mkSession, type Harness } from '../sidepanel/model/test-kit';
import { SessionRepo, SettingsRepo } from '../storage';
import { createWelcomeStore, stepsOf, initialWelcome, type WelcomeEnv, type WelcomeStore } from './model';

let store: WelcomeStore | null = null;
afterEach(async () => {
  await store?.dispose();
  store = null;
});

const start = async (config: PlatformTestConfig = {}) => {
  const harness: Harness = makeHarness(config);
  store = createWelcomeStore(harness.layer as never, { pinPollMs: 20 });
  await store.ready;
  const s = store;
  const waitFor = (p: (x: ReturnType<WelcomeStore['getSnapshot']>) => boolean) =>
    vi.waitFor(() => {
      if (!p(s.getSnapshot())) throw new Error('not yet');
    });
  const run = <A>(eff: Effect.Effect<A, unknown, WelcomeEnv | TestRecorder>) => s.run(eff as never) as Promise<A>;
  return { store: s, harness, waitFor, run };
};

describe('stepsOf', () => {
  it('marks each step done from state', () => {
    expect(stepsOf(initialWelcome)).toEqual({ pin: false, role: false, tried: false, done: 0 });
    expect(stepsOf({ ...initialWelcome, pinned: true, presetChosen: true })).toMatchObject({ done: 2 });
    expect(stepsOf({ ...initialWelcome, pinned: true, presetChosen: true, hasNotes: true })).toMatchObject({ tried: true, done: 3 });
  });
});

describe('welcome store', () => {
  it('ticks the try-it step once the first note creates a session', async () => {
    const { waitFor, run } = await start();
    await waitFor((x) => x.loaded && !x.hasNotes);
    await run(Effect.flatMap(SessionRepo, (r) => r.insert(mkSession())));
    await waitFor((x) => x.hasNotes);
  });

  it('loads preset, pinned state and the pick shortcut', async () => {
    const { waitFor, store: s } = await start({ extension: { pinned: false, shortcut: 'Alt+Shift+F' } });
    await waitFor((x) => x.loaded);
    expect(s.getSnapshot()).toMatchObject({ preset: 'reviewer', pinned: false, shortcut: 'Alt+Shift+F', presetChosen: false });
  });

  it('stops checking the pinned state when Chrome cannot report it', async () => {
    const { waitFor, store: s, run } = await start({ extension: { pinned: null } });
    await waitFor((x) => x.loaded);
    await new Promise((r) => setTimeout(r, 100));
    expect(s.getSnapshot().pinned).toBe(false);
    const reads = (await run(Effect.flatMap(TestRecorder, (r) => r.calls))).filter((c) => c.op === 'isPinned');
    expect(reads.length).toBeLessThanOrEqual(2);
  });

  it('starts no streams when disposed before loading finished', async () => {
    const harness = makeHarness();
    const early = createWelcomeStore(harness.layer as never, { pinPollMs: 20 });
    await early.dispose();
    await expect(early.ready).resolves.toBeUndefined();
  });

  it('saves a chosen preset through the background and marks the step done', async () => {
    const { waitFor, store: s, harness, run } = await start();
    await waitFor((x) => x.loaded);
    await s.actions.choosePreset('developer');
    await waitFor((x) => x.preset === 'developer' && x.presetChosen);
    expect(harness.toBackground).toContainEqual({ _tag: 'SettingsUpdate', patch: { preset: 'developer' } });
    expect((await run(Effect.flatMap(SettingsRepo, (r) => r.get))).preset).toBe('developer');
  });

  it('flags a failed save and keeps the step open', async () => {
    const { waitFor, store: s, harness } = await start();
    await waitFor((x) => x.loaded);
    harness.failBackground.current = 'StorageUnavailable';
    await s.actions.choosePreset('developer');
    expect(s.getSnapshot()).toMatchObject({ saveFailed: true, presetChosen: false });
    harness.failBackground.current = null;
    await s.actions.choosePreset('developer');
    await waitFor((x) => x.presetChosen && !x.saveFailed);
  });

  it('follows preset changes made elsewhere', async () => {
    const { waitFor, run } = await start();
    await waitFor((x) => x.loaded);
    await run(Effect.flatMap(SettingsRepo, (r) => r.put({ ...defaultSettings, preset: 'developer' })));
    await waitFor((x) => x.preset === 'developer');
  });

  it('opens the example page and the shortcut settings in new tabs', async () => {
    const { store: s, run } = await start();
    await s.actions.openExample();
    await s.actions.openShortcuts();
    const calls = (await run(Effect.flatMap(TestRecorder, (r) => r.calls))).filter((c) => c.op === 'openUrl');
    expect(calls).toEqual([
      { service: 'Extension', op: 'openUrl', args: ['https://example.com/'] },
      { service: 'Extension', op: 'openUrl', args: ['chrome://extensions/shortcuts'] },
    ]);
  });
});
