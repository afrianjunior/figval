import { Effect, Fiber, Option, Schema, Stream } from 'effect';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TabId } from '../domain';
import { ActionLive, Action } from './action';
import { Capture, CaptureLive } from './capture';
import { Clipboard, ClipboardLive } from './clipboard';
import { Clock, ClockFixed, ClockLive } from './clock';
import { Commands, CommandsLive } from './commands';
import { Download, DownloadLive, markdownDataUrl } from './download';
import { installFakeChrome, makeFakeChrome, uninstallFakeChrome, type FakeChrome } from './fake-chrome';
import { Ids, IdsLive } from './ids';
import { Permissions, PermissionsLive } from './permissions';
import { CONTENT_SCRIPT_FILE, Scripting, ScriptingLive } from './scripting';
import { SidePanel, SidePanelLive } from './side-panel';
import { Tabs, TabsLive } from './tabs';

const tid = Schema.decodeSync(TabId)(3);
const settle = Effect.repeatN(Effect.yieldNow(), 10);
let fake: FakeChrome;

beforeEach(() => {
  fake = makeFakeChrome({
    tabs: [
      { id: 3, url: 'https://a.test/', title: 'A', windowId: 9, active: true },
      { windowId: 9, active: false },
    ],
  });
  installFakeChrome(fake);
});
afterEach(() => {
  uninstallFakeChrome();
  vi.unstubAllGlobals();
});

describe('TabsLive', () => {
  const run = <A, E>(eff: Effect.Effect<A, E, Tabs>) => Effect.runPromise(Effect.provide(eff, TabsLive));

  it('gets and maps a tab', async () => {
    expect(await run(Effect.flatMap(Tabs, (t) => t.get(tid)))).toEqual({ id: 3, url: 'https://a.test/', title: 'A', windowId: 9 });
  });

  it('fails UnsupportedPage for unknown tabs and tabs without id', async () => {
    const missing = await run(Effect.flatMap(Tabs, (t) => Effect.flip(t.get(Schema.decodeSync(TabId)(77)))));
    expect(missing._tag).toBe('UnsupportedPage');
    fake.tabs.get.mockResolvedValueOnce({ windowId: 1 });
    const noId = await run(Effect.flatMap(Tabs, (t) => Effect.flip(t.get(tid))));
    expect(noId._tag).toBe('UnsupportedPage');
  });

  it('queries the active tab, tolerating failures', async () => {
    const active = await run(Effect.flatMap(Tabs, (t) => t.queryActive));
    expect(Option.map(active, (t) => t.id)).toEqual(Option.some(3));
    fake.tabs.query.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    expect(Option.isNone(await run(Effect.flatMap(Tabs, (t) => t.queryActive)))).toBe(true);
  });

  it('streams activations (via tabs.get) and active-tab updates, then unsubscribes', async () => {
    const urls = await run(
      Effect.gen(function* () {
        const tabs = yield* Tabs;
        const fiber = yield* Effect.fork(Stream.runCollect(Stream.take(tabs.activeChanges, 2)));
        yield* settle;
        fake.tabs.onActivated.emit({ tabId: 3 });
        fake.tabs.onUpdated.emit(3, { status: 'complete' }, { id: 3, url: 'https://b.test/', windowId: 9, active: true });
        fake.tabs.onUpdated.emit(3, {}, { id: 3, url: 'ignored', windowId: 9, active: true });
        fake.tabs.onUpdated.emit(3, { status: 'loading' }, { id: 3, url: 'ignored', windowId: 9, active: false });
        return Array.from(yield* Fiber.join(fiber)).map((t) => t.url);
      }),
    );
    expect([...urls].sort()).toEqual(['https://a.test/', 'https://b.test/']);
    expect(fake.tabs.onActivated.listeners.size).toBe(0);
    expect(fake.tabs.onUpdated.listeners.size).toBe(0);
  });

  it('streams removals', async () => {
    const removed = await run(
      Effect.gen(function* () {
        const fiber = yield* Effect.fork(Stream.runCollect(Stream.take((yield* Tabs).onRemoved, 1)));
        yield* settle;
        fake.tabs.onRemoved.emit(-1);
        fake.tabs.onRemoved.emit(3);
        return Array.from(yield* Fiber.join(fiber));
      }),
    );
    expect(removed).toEqual([3]);
    expect(fake.tabs.onRemoved.listeners.size).toBe(0);
  });
});

describe('ScriptingLive', () => {
  const inject = (ping?: Effect.Effect<unknown, unknown>) =>
    Effect.runPromise(Effect.provide(Effect.flatMap(Scripting, (s) => s.injectContent(tid, ping)), ScriptingLive));

  it('injects the content script file', async () => {
    await inject();
    expect(fake.scripting.executeScript).toHaveBeenCalledWith({ target: { tabId: tid }, files: [CONTENT_SCRIPT_FILE] });
  });

  it('skips injection when the ping succeeds, injects when it fails', async () => {
    await inject(Effect.void);
    expect(fake.scripting.executeScript).not.toHaveBeenCalled();
    await inject(Effect.fail('x'));
    expect(fake.scripting.executeScript).toHaveBeenCalledTimes(1);
  });

  it('maps a rejection to InjectionFailed', async () => {
    fake.scripting.executeScript.mockRejectedValueOnce(new Error('denied'));
    const err = await Effect.runPromise(
      Effect.provide(Effect.flatMap(Scripting, (s) => Effect.flip(s.injectContent(tid))), ScriptingLive),
    );
    expect(err).toMatchObject({ _tag: 'InjectionFailed', tabId: tid });
  });
});

describe('PermissionsLive', () => {
  const ensure = (origin = 'https://a.test') =>
    Effect.provide(Effect.flatMap(Permissions, (p) => Effect.either(p.ensureOrigin(origin))), PermissionsLive);

  it('does not prompt when the origin is already granted', async () => {
    fake.permissions.contains.mockResolvedValueOnce(true);
    expect((await Effect.runPromise(ensure()))._tag).toBe('Right');
    expect(fake.permissions.request).not.toHaveBeenCalled();
  });

  it('requests the origin pattern when missing', async () => {
    expect((await Effect.runPromise(ensure()))._tag).toBe('Right');
    expect(fake.permissions.request).toHaveBeenCalledWith({ origins: ['https://a.test/*'] });
  });

  it('denies when the prompt is declined or throws', async () => {
    fake.permissions.request.mockResolvedValueOnce(false);
    const declined = await Effect.runPromise(ensure());
    expect(declined._tag === 'Left' && declined.left).toMatchObject({ _tag: 'PermissionDenied', origin: 'https://a.test' });
    fake.permissions.contains.mockRejectedValueOnce(new Error('x'));
    expect((await Effect.runPromise(ensure()))._tag).toBe('Left');
    fake.permissions.request.mockRejectedValueOnce(new Error('x'));
    expect((await Effect.runPromise(ensure()))._tag).toBe('Left');
  });
});

describe('CaptureLive', () => {
  const stubImaging = (width = 200, height = 100) => {
    const draw = vi.fn();
    const close = vi.fn();
    class FakeCanvas {
      constructor(public width: number, public height: number) {}
      getContext = () => ({ drawImage: draw });
      convertToBlob = (o: { type: string }) => Promise.resolve(new Blob(['x'], { type: o.type }));
    }
    vi.stubGlobal('OffscreenCanvas', FakeCanvas);
    vi.stubGlobal('createImageBitmap', () => Promise.resolve({ width, height, close }));
    vi.stubGlobal('fetch', () => Promise.resolve({ blob: () => Promise.resolve(new Blob(['png'])) }));
    return { draw, close };
  };
  const live = <A, E>(eff: Effect.Effect<A, E, Capture>) => Effect.runPromise(Effect.provide(eff, CaptureLive));

  it('captures the visible tab as png', async () => {
    expect(await live(Effect.flatMap(Capture, (c) => c.visibleTab(9)))).toContain('data:image/png');
    expect(fake.tabs.captureVisibleTab).toHaveBeenCalledWith(9, { format: 'png' });
  });

  it('wraps capture failures', async () => {
    fake.tabs.captureVisibleTab.mockRejectedValueOnce(new Error('no permission'));
    const err = await live(Effect.flatMap(Capture, (c) => Effect.flip(c.visibleTab(9))));
    expect(err).toMatchObject({ _tag: 'CaptureFailed', reason: 'no permission' });
  });

  it('crops by rect × dpr and encodes webp', async () => {
    const { draw, close } = stubImaging();
    const blob = await live(Effect.flatMap(Capture, (c) => c.crop('data:image/png;base64,AA', { x: 10, y: 5, w: 20, h: 10 }, 2)));
    expect(blob.type).toBe('image/webp');
    expect(draw).toHaveBeenCalledWith(expect.anything(), 20, 10, 40, 20, 0, 0, 40, 20);
    expect(close).toHaveBeenCalled();
  });

  it('fails CaptureFailed on an empty crop region and on a missing 2d context', async () => {
    stubImaging();
    const empty = await live(
      Effect.flatMap(Capture, (c) => Effect.flip(c.crop('d', { x: 900, y: 900, w: 5, h: 5 }, 1))),
    );
    expect(empty).toMatchObject({ _tag: 'CaptureFailed', reason: 'crop region is empty' });
    vi.stubGlobal('OffscreenCanvas', class { getContext = () => null; });
    const noCtx = await live(Effect.flatMap(Capture, (c) => Effect.flip(c.crop('d', { x: 0, y: 0, w: 5, h: 5 }, 1))));
    expect(noCtx.reason).toBe('2d context unavailable');
  });
});

describe('ClipboardLive', () => {
  const live = <A, E>(eff: Effect.Effect<A, E, Clipboard>) => Effect.runPromise(Effect.provide(eff, ClipboardLive));

  it('writes text', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await live(Effect.flatMap(Clipboard, (c) => c.writeText('hi')));
    expect(writeText).toHaveBeenCalledWith('hi');
  });

  it('converts webp to png and writes an image/png item', async () => {
    const write = vi.fn<(items: unknown[]) => Promise<void>>(() => Promise.resolve());
    class FakeItem {
      constructor(public data: Record<string, Promise<Blob>>) {}
    }
    vi.stubGlobal('navigator', { clipboard: { write } });
    vi.stubGlobal('ClipboardItem', FakeItem);
    vi.stubGlobal('createImageBitmap', () => Promise.resolve({ width: 4, height: 3, close: () => undefined }));
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        getContext = () => ({ drawImage: () => undefined });
        convertToBlob = (o: { type: string }) => Promise.resolve(new Blob(['p'], { type: o.type }));
      },
    );
    await live(Effect.flatMap(Clipboard, (c) => c.writeImage(new Blob(['w'], { type: 'image/webp' }))));
    const item = write.mock.calls[0]?.[0][0] as FakeItem;
    expect((await item.data['image/png'])?.type).toBe('image/png');
  });

  it('maps rejections to ClipboardDenied', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.reject(new Error('blocked')) } });
    const err = await live(Effect.flatMap(Clipboard, (c) => Effect.flip(c.writeText('x'))));
    expect(err._tag).toBe('ClipboardDenied');
  });
});

describe('DownloadLive, SidePanelLive, ClockLive, IdsLive', () => {
  it('downloads markdown through a data URL', async () => {
    await Effect.runPromise(Effect.provide(Effect.flatMap(Download, (d) => d.markdown('r.md', '# Héllo\n')), DownloadLive));
    expect(fake.downloads.download).toHaveBeenCalledWith({
      url: markdownDataUrl('# Héllo\n'),
      filename: 'r.md',
      saveAs: true,
    });
    expect(decodeURIComponent(markdownDataUrl('# Héllo\n').split(',')[1] ?? '')).toBe('# Héllo\n');
  });

  it('treats a failed download as a defect', async () => {
    fake.downloads.download.mockRejectedValueOnce(new Error('x'));
    const exit = await Effect.runPromiseExit(Effect.provide(Effect.flatMap(Download, (d) => d.markdown('r.md', '')), DownloadLive));
    expect(exit._tag).toBe('Failure');
  });

  it('configures and opens the side panel', async () => {
    await Effect.runPromise(
      Effect.provide(
        Effect.flatMap(SidePanel, (s) => Effect.zipRight(s.setPanelBehavior(true), s.open(3))),
        SidePanelLive,
      ),
    );
    expect(fake.sidePanel.setPanelBehavior).toHaveBeenCalledWith({ openPanelOnActionClick: true });
    expect(fake.sidePanel.open).toHaveBeenCalledWith({ tabId: 3 });
  });

  it('reads the wall clock', async () => {
    const now = await Effect.runPromise(Effect.provide(Effect.flatMap(Clock, (c) => c.now), ClockLive));
    expect(Math.abs(now - Date.now())).toBeLessThan(1000);
    expect(await Effect.runPromise(Effect.provide(Effect.flatMap(Clock, (c) => c.now), ClockFixed(5)))).toBe(5);
  });

  it('generates unique random ids', async () => {
    const [a, b, s] = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* () {
          const ids = yield* Ids;
          return [yield* ids.noteId, yield* ids.noteId, yield* ids.sessionId] as const;
        }),
        IdsLive,
      ),
    );
    expect(a).not.toBe(b);
    expect(s).toMatch(/^fv-[a-z0-9]{4}$/);
    await Effect.runPromise(Effect.provide(Effect.flatMap(Ids, (i) => i.shotId), IdsLive));
  });
});

describe('CommandsLive and ActionLive', () => {
  it('streams commands and unsubscribes', async () => {
    const names = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* () {
          const fiber = yield* Effect.fork(Stream.runCollect(Stream.take((yield* Commands).onCommand, 1)));
          yield* settle;
          fake.commands.onCommand.emit('pick');
          return Array.from(yield* Fiber.join(fiber));
        }),
        CommandsLive,
      ),
    );
    expect(names).toEqual(['pick']);
    expect(fake.commands.onCommand.listeners.size).toBe(0);
  });

  it('streams toolbar clicks, dropping tabs without an id', async () => {
    const tabs = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* () {
          const fiber = yield* Effect.fork(Stream.runCollect(Stream.take((yield* Action).onClicked, 1)));
          yield* settle;
          fake.action.onClicked.emit({ windowId: 1 });
          fake.action.onClicked.emit({ id: 3, url: 'https://a.test/', windowId: 9 });
          return Array.from(yield* Fiber.join(fiber));
        }),
        ActionLive,
      ),
    );
    expect(tabs).toEqual([{ id: 3, url: 'https://a.test/', title: '', windowId: 9 }]);
    expect(fake.action.onClicked.listeners.size).toBe(0);
  });
});
