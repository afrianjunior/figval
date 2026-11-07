import { Effect, Fiber, Layer, Option, Stream, TestContext } from 'effect';
import { describe, expect, it } from 'vitest';
import { Schema } from 'effect';
import { makeNoteId, makeSessionId, makeShotId, NoteId, SessionId, ShotId, TabId } from '../domain';
import { Action } from './action';
import { Capture, FIXED_SCREENSHOT_DATA_URL } from './capture';
import { Clipboard } from './clipboard';
import { Clock } from './clock';
import { Commands } from './commands';
import { Download } from './download';
import { fixedWebp } from './image';
import { Ids } from './ids';
import { PlatformTest, type PlatformTestConfig } from './layers';
import { Permissions } from './permissions';
import { Scripting } from './scripting';
import { SidePanel } from './side-panel';
import { Tabs } from './tabs';
import { TestDriver, TestRecorder } from './test-driver';
import type { TabInfo } from './types';

const tab = (id: number, url = `https://site${id}.test/`): TabInfo => ({
  id: Schema.decodeSync(TabId)(id),
  url,
  title: `Tab ${id}`,
  windowId: 1,
});
const t1 = tab(1);
const t2 = tab(2);

const run = <A, E>(eff: Effect.Effect<A, E, Layer.Layer.Success<ReturnType<typeof PlatformTest>>>, config?: PlatformTestConfig) =>
  Effect.runPromise(eff.pipe(Effect.provide(PlatformTest(config)), Effect.provide(TestContext.TestContext)));

/** Lets a forked stream fiber reach its subscription before the driver publishes. */
const settle = Effect.repeatN(Effect.yieldNow(), 10);
const calls = Effect.flatMap(TestRecorder, (r) => r.calls);

describe('Tabs test layer', () => {
  const config = { tabs: [t1, t2], activeTabId: t1.id };

  it('gets a tab and fails with UnsupportedPage for an unknown one', async () => {
    const [found, missing] = await run(
      Effect.gen(function* () {
        const tabs = yield* Tabs;
        return [yield* tabs.get(t2.id), yield* Effect.flip(tabs.get(Schema.decodeSync(TabId)(99)))] as const;
      }),
      config,
    );
    expect(found).toEqual(t2);
    expect(missing._tag).toBe('UnsupportedPage');
  });

  it('queries the active tab', async () => {
    const active = await run(Effect.flatMap(Tabs, (t) => t.queryActive), config);
    expect(active).toEqual(Option.some(t1));
    const none = await run(Effect.flatMap(Tabs, (t) => t.queryActive));
    expect(Option.isNone(none)).toBe(true);
  });

  it('streams activations and navigations of the active tab', async () => {
    const seen = await run(
      Effect.gen(function* () {
        const tabs = yield* Tabs;
        const driver = yield* TestDriver;
        const fiber = yield* Effect.fork(Stream.runCollect(Stream.take(tabs.activeChanges, 2)));
        yield* settle;
        yield* driver.activate(t2.id);
        yield* driver.navigate(t2.id, 'https://moved.test/');
        yield* driver.navigate(t1.id, 'https://not-active.test/');
        return Array.from(yield* Fiber.join(fiber)).map((x) => x.url);
      }),
      config,
    );
    expect(seen).toEqual([t2.url, 'https://moved.test/']);
  });

  it('streams removals and clears the active tab', async () => {
    const [removed, active] = await run(
      Effect.gen(function* () {
        const tabs = yield* Tabs;
        const driver = yield* TestDriver;
        const fiber = yield* Effect.fork(Stream.runCollect(Stream.take(tabs.onRemoved, 1)));
        yield* settle;
        yield* driver.removeTab(t1.id);
        return [Array.from(yield* Fiber.join(fiber)), yield* driver.activeTabId] as const;
      }),
      config,
    );
    expect(removed).toEqual([t1.id]);
    expect(active).toBeNull();
  });

  it('driver adds tabs', async () => {
    const found = await run(
      Effect.gen(function* () {
        const driver = yield* TestDriver;
        yield* driver.addTab(t2);
        return yield* (yield* Tabs).get(t2.id);
      }),
    );
    expect(found).toEqual(t2);
  });
});

describe('Commands and Action test layers', () => {
  it('streams commands', async () => {
    const names = await run(
      Effect.gen(function* () {
        const driver = yield* TestDriver;
        const fiber = yield* Effect.fork(Stream.runCollect(Stream.take((yield* Commands).onCommand, 1)));
        yield* settle;
        yield* driver.emitCommand('pick');
        return Array.from(yield* Fiber.join(fiber));
      }),
    );
    expect(names).toEqual(['pick']);
  });

  it('streams toolbar clicks as tabs, ignoring unknown tabs', async () => {
    const clicked = await run(
      Effect.gen(function* () {
        const driver = yield* TestDriver;
        const fiber = yield* Effect.fork(Stream.runCollect(Stream.take((yield* Action).onClicked, 1)));
        yield* settle;
        yield* driver.clickAction(Schema.decodeSync(TabId)(42));
        yield* driver.clickAction(t1.id);
        return Array.from(yield* Fiber.join(fiber));
      }),
      { tabs: [t1] },
    );
    expect(clicked).toEqual([t1]);
  });
});

describe('Scripting test layer', () => {
  it('records an injection', async () => {
    const recorded = await run(
      Effect.gen(function* () {
        yield* (yield* Scripting).injectContent(t1.id);
        return yield* calls;
      }),
    );
    expect(recorded).toEqual([{ service: 'Scripting', op: 'injectContent', args: [t1.id] }]);
  });

  it('skips injection when the content script is alive', async () => {
    const recorded = await run(
      Effect.gen(function* () {
        yield* (yield* Scripting).injectContent(t1.id);
        return yield* calls;
      }),
      { scripting: { alive: [t1.id] } },
    );
    expect(recorded).toEqual([]);
  });

  it('uses a passed-in ping', async () => {
    const [skipped, injected] = await run(
      Effect.gen(function* () {
        const s = yield* Scripting;
        yield* s.injectContent(t1.id, Effect.void);
        const afterAlive = yield* calls;
        yield* s.injectContent(t2.id, Effect.fail('dead'));
        return [afterAlive.length, (yield* calls).length] as const;
      }),
    );
    expect([skipped, injected]).toEqual([0, 1]);
  });

  it('fails with InjectionFailed for configured tabs', async () => {
    const err = await run(
      Effect.flip(Effect.flatMap(Scripting, (s) => s.injectContent(t1.id))),
      { scripting: { failing: [t1.id] } },
    );
    expect(err).toMatchObject({ _tag: 'InjectionFailed', tabId: t1.id });
  });
});

describe('Permissions test layer', () => {
  it('grants by default and records', async () => {
    const recorded = await run(
      Effect.gen(function* () {
        yield* (yield* Permissions).ensureOrigin('https://a.test');
        return yield* calls;
      }),
    );
    expect(recorded[0]).toMatchObject({ op: 'ensureOrigin', args: ['https://a.test'] });
  });

  it('denies when the prompt is declined and the origin is not granted', async () => {
    const eff = Effect.flatMap(Permissions, (p) => Effect.flip(p.ensureOrigin('https://a.test')));
    expect(await run(eff, { permissions: { acceptPrompt: false } })).toMatchObject({
      _tag: 'PermissionDenied',
      origin: 'https://a.test',
    });
    const ok = Effect.flatMap(Permissions, (p) => p.ensureOrigin('https://a.test'));
    await run(ok, { permissions: { acceptPrompt: false, granted: ['https://a.test'] } });
  });
});

describe('Capture test layer', () => {
  it('returns a fixed image and a 1x1 WebP blob, recording both calls', async () => {
    const [url, blob, recorded] = await run(
      Effect.gen(function* () {
        const c = yield* Capture;
        const dataUrl = yield* c.visibleTab(1);
        const webp = yield* c.crop(dataUrl, { x: 0, y: 0, w: 1, h: 1 }, 2);
        return [dataUrl, webp, yield* calls] as const;
      }),
    );
    expect(url).toBe(FIXED_SCREENSHOT_DATA_URL);
    expect(blob.type).toBe('image/webp');
    expect(blob.size).toBe(fixedWebp().size);
    const head = new TextDecoder().decode(new Uint8Array(await blob.arrayBuffer()).slice(0, 4));
    expect(head).toBe('RIFF');
    expect(recorded.map((c) => c.op)).toEqual(['visibleTab', 'crop']);
  });

  it('fails with CaptureFailed when configured', async () => {
    const err = await run(Effect.flip(Effect.flatMap(Capture, (c) => c.visibleTab(1))), { capture: { failWith: 'nope' } });
    expect(err).toMatchObject({ _tag: 'CaptureFailed', reason: 'nope' });
    const err2 = await run(
      Effect.flip(Effect.flatMap(Capture, (c) => c.crop('x', { x: 0, y: 0, w: 1, h: 1 }, 1))),
      { capture: { failWith: 'bad' } },
    );
    expect(err2.reason).toBe('bad');
  });
});

describe('Clipboard, Download, SidePanel test layers', () => {
  it('records text and image writes', async () => {
    const recorded = await run(
      Effect.gen(function* () {
        const c = yield* Clipboard;
        yield* c.writeText('hello');
        yield* c.writeImage(fixedWebp());
        return yield* calls;
      }),
    );
    expect(recorded.map((c) => [c.service, c.op])).toEqual([
      ['Clipboard', 'writeText'],
      ['Clipboard', 'writeImage'],
    ]);
    expect(recorded[0]?.args).toEqual(['hello']);
  });

  it('denies clipboard writes when configured', async () => {
    const err = await run(Effect.flip(Effect.flatMap(Clipboard, (c) => c.writeText('x'))), { clipboard: { deny: true } });
    expect(err._tag).toBe('ClipboardDenied');
  });

  it('records downloads and side panel calls', async () => {
    const recorded = await run(
      Effect.gen(function* () {
        yield* (yield* Download).markdown('a.md', '# a');
        const panel = yield* SidePanel;
        yield* panel.setPanelBehavior(true);
        yield* panel.open(5);
        return yield* calls;
      }),
    );
    expect(recorded.map((c) => `${c.service}.${c.op}`)).toEqual([
      'Download.markdown',
      'SidePanel.setPanelBehavior',
      'SidePanel.open',
    ]);
    expect(recorded[0]?.args).toEqual(['a.md', '# a']);
  });
});

describe('Clock and Ids test layers', () => {
  it('uses a fixed clock', async () => {
    expect(await run(Effect.flatMap(Clock, (c) => c.now), { now: 1234 })).toBe(1234);
    expect(await run(Effect.flatMap(Clock, (c) => c.now))).toBe(0);
  });

  it('produces valid, distinct, repeatable sequence ids', async () => {
    const gen = Effect.gen(function* () {
      const ids = yield* Ids;
      return [yield* ids.noteId, yield* ids.shotId, yield* ids.sessionId, yield* ids.noteId] as const;
    });
    const first = await run(gen);
    const second = await run(gen);
    expect(first).toEqual(second);
    expect(Schema.is(NoteId)(first[0])).toBe(true);
    expect(Schema.is(ShotId)(first[1])).toBe(true);
    expect(Schema.is(SessionId)(first[2])).toBe(true);
    expect(first[0]).not.toBe(first[3]);
  });

  it('domain generators accept the crypto-style inputs the Live layer uses', () => {
    const bytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));
    expect(Schema.is(NoteId)(makeNoteId(bytes))).toBe(true);
    expect(Schema.is(ShotId)(makeShotId(bytes))).toBe(true);
    expect(Schema.is(SessionId)(makeSessionId(() => 0.5))).toBe(true);
  });
});
