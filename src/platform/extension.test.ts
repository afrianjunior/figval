import { Effect, Fiber, Stream } from 'effect';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Extension, ExtensionLive, ExtensionTest } from './extension';
import { installFakeChrome, makeFakeChrome, uninstallFakeChrome, type FakeChrome } from './fake-chrome';
import { TestDriver, TestRecorder, TestDriverLive, TestRecorderLive } from './test-driver';
import { Layer } from 'effect';

const settle = Effect.repeatN(Effect.yieldNow(), 10);
let fake: FakeChrome;

beforeEach(() => {
  fake = makeFakeChrome();
  installFakeChrome(fake);
});
afterEach(() => uninstallFakeChrome());

const live = <A, E>(eff: Effect.Effect<A, E, Extension>) => Effect.runPromise(Effect.provide(eff, ExtensionLive));

describe('ExtensionLive', () => {
  it('streams install reasons and unsubscribes', async () => {
    const reasons = await live(
      Effect.gen(function* () {
        const fiber = yield* Effect.fork(Stream.runCollect(Stream.take((yield* Extension).onInstalled, 2)));
        yield* settle;
        fake.runtime.onInstalled.emit({ reason: 'install' });
        fake.runtime.onInstalled.emit({ reason: 'update' });
        return Array.from(yield* Fiber.join(fiber));
      }),
    );
    expect(reasons).toEqual(['install', 'update']);
    expect(fake.runtime.onInstalled.listeners.size).toBe(0);
  });

  it('opens an extension page by its packaged path', async () => {
    await live(Effect.flatMap(Extension, (e) => e.openPage('/welcome.html')));
    expect(fake.tabs.create).toHaveBeenCalledWith({ url: 'chrome-extension://ext-id/welcome.html' });
  });

  it('opens an absolute url as is', async () => {
    await live(Effect.flatMap(Extension, (e) => e.openUrl('chrome://extensions/shortcuts')));
    expect(fake.tabs.create).toHaveBeenCalledWith({ url: 'chrome://extensions/shortcuts' });
  });

  it('reports whether the toolbar icon is pinned', async () => {
    expect(await live(Effect.flatMap(Extension, (e) => e.isPinned))).toBe(false);
    fake.action.getUserSettings.mockResolvedValueOnce({ isOnToolbar: true });
    expect(await live(Effect.flatMap(Extension, (e) => e.isPinned))).toBe(true);
  });

  it('reports an unreadable pinned state as unknown (null)', async () => {
    fake.action.getUserSettings.mockRejectedValueOnce(new Error('old Chrome'));
    expect(await live(Effect.flatMap(Extension, (e) => e.isPinned))).toBeNull();
  });

  it('reads a command shortcut, empty when unassigned or unknown', async () => {
    expect(await live(Effect.flatMap(Extension, (e) => e.shortcut('pick')))).toBe('⌥⇧F');
    fake.commands.getAll.mockResolvedValueOnce([{ name: 'pick', shortcut: '' }]);
    expect(await live(Effect.flatMap(Extension, (e) => e.shortcut('pick')))).toBe('');
    fake.commands.getAll.mockRejectedValueOnce(new Error('x'));
    expect(await live(Effect.flatMap(Extension, (e) => e.shortcut('pick')))).toBe('');
  });
});

describe('ExtensionTest', () => {
  const base = Layer.merge(TestRecorderLive, TestDriverLive());
  const run = <A, E>(eff: Effect.Effect<A, E, Extension | TestDriver | TestRecorder>, config = {}) =>
    Effect.runPromise(Effect.provide(eff, Layer.provideMerge(ExtensionTest(config), base)));

  it('records opened pages and serves configured toolbar state', async () => {
    const result = await run(
      Effect.gen(function* () {
        const ext = yield* Extension;
        yield* ext.openPage('/welcome.html');
        const pinned = yield* ext.isPinned;
        const calls = (yield* (yield* TestRecorder).calls).filter((c) => c.op === 'openPage');
        return { pinned, shortcut: yield* ext.shortcut('pick'), calls };
      }),
      { pinned: true, shortcut: 'Alt+Shift+F' },
    );
    expect(result).toEqual({
      pinned: true,
      shortcut: 'Alt+Shift+F',
      calls: [{ service: 'Extension', op: 'openPage', args: ['/welcome.html'] }],
    });
  });

  it('emits installs pushed through the driver', async () => {
    const reasons = await run(
      Effect.gen(function* () {
        const fiber = yield* Effect.fork(Stream.runCollect(Stream.take((yield* Extension).onInstalled, 1)));
        yield* settle;
        yield* (yield* TestDriver).emitInstall('install');
        return Array.from(yield* Fiber.join(fiber));
      }),
    );
    expect(reasons).toEqual(['install']);
  });
});
