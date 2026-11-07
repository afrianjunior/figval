import { Effect, Exit, Layer, Scope } from 'effect';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyEdits } from '../../domain';
import { makeMessengerLoopback, Messenger } from '../../messaging';
import { sampleRequests, tabId } from '../../messaging/fixtures';
import { SessionStoreMemory } from '../../storage';
import { CONTENT_FLAG, main, startContent, type ContentApp } from '../main';
import { HOST_TAG } from '../picker';
import { noteFor, recordingPort } from '../picker/test-support';

let scope: Scope.CloseableScope;
let port: ReturnType<typeof recordingPort>;
let app: ContentApp;
let send: <A>(req: Parameters<Messenger['Type']['toContent']>[1]) => Promise<A>;
let reports: Array<readonly string[]>;

beforeEach(async () => {
  document.body.innerHTML = '<main><h1 id="a" class="hero">Title</h1><p id="b">Body</p></main>';
  port = recordingPort();
  reports = [];
  scope = Effect.runSync(Scope.make());
  const ctx = await Effect.runPromise(
    Layer.buildWithScope(
      Layer.mergeAll(makeMessengerLoopback(), SessionStoreMemory(), port.layer),
      scope,
    ),
  );
  const program = Effect.gen(function* () {
    const m = yield* Messenger;
    yield* m.serve('background', (req) =>
      Effect.sync(() => void (req._tag === 'MissingReport' && reports.push(req.ids))),
    );
    app = yield* startContent({ resolveAsset: (p) => `ext:${p}` });
    return m;
  }).pipe(Scope.extend(scope), Effect.provide(ctx));
  const messenger = await Effect.runPromise(program);
  send = (req) =>
    Effect.runPromise(messenger.toContent(tabId, req) as Effect.Effect<never>) as never;
});
afterEach(async () => {
  await Effect.runPromise(Scope.close(scope, Exit.void));
});

describe('content router', () => {
  it('answers Ping', async () => {
    expect(await send(sampleRequests.Ping)).toEqual({ pong: true });
  });

  it('PickerStart arms the picker and PickerStop releases it', async () => {
    const a = document.getElementById('a')!;
    await send(sampleRequests.PickerStart);
    a.dispatchEvent(new MouseEvent('pointermove', { bubbles: true }));
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    a.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(port.calls).toHaveLength(1);

    await send(sampleRequests.PickerStart);
    await send(sampleRequests.PickerStop);
    const after = new MouseEvent('click', { bubbles: true, cancelable: true });
    a.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });

  it('PickerStart also arms the text-selection button', async () => {
    await send(sampleRequests.PickerStart);
    expect(app.host.layer.querySelector('.fv-ov-addnote')).not.toBeNull();
  });

  it('UiHide / UiShow toggle the host and the tooltip', async () => {
    await send(sampleRequests.UiHide);
    expect(app.host.isHidden()).toBe(true);
    await send(sampleRequests.UiShow);
    expect(app.host.isHidden()).toBe(false);
    expect(port.events).toEqual(['hide', 'show']);
  });

  it('EditsOff / EditsOn drive the edit registry', async () => {
    await send(sampleRequests.EditsOff);
    expect(app.registry.isOn()).toBe(false);
    await send(sampleRequests.EditsOn);
    expect(app.registry.isOn()).toBe(true);
  });

  it('renders, highlights, scrolls to, reopens, and clears markers', async () => {
    const a = document.getElementById('a')!;
    a.scrollIntoView = vi.fn();
    const n = noteFor(a, 1, {
      ...emptyEdits,
      hidden: false,
      style: [{ property: 'color', before: 'a', after: 'b' }],
    });
    const gone = {
      ...noteFor(document.getElementById('b')!, 2),
      target: { ...noteFor(a, 2).target, selector: '#nope', attrs: {}, text: 'zz', domPath: [] },
    };
    await send({ ...sampleRequests.MarkersRender, notes: [n, gone], highlightId: n.id });
    expect(app.host.layer.querySelectorAll('.fv-slot')).toHaveLength(1);
    expect(app.host.layer.querySelector('.fv-pin--active')).not.toBeNull();
    expect(app.registry.entries()).toHaveLength(1);
    await vi.waitFor(() => expect(reports).toEqual([[gone.id]]));

    await send({ ...sampleRequests.Highlight, noteId: null });
    expect(app.host.layer.querySelector('.fv-pin--active')).toBeNull();
    await send({ ...sampleRequests.ScrollTo, noteId: n.id });
    expect(a.scrollIntoView).toHaveBeenCalled();
    await send({ ...sampleRequests.TooltipReopen, noteId: n.id });
    expect(port.calls.at(-1)?.opts).toMatchObject({ mode: 'reopen', noteId: n.id });

    await send(sampleRequests.MarkersClear);
    expect(app.host.layer.querySelectorAll('.fv-slot')).toHaveLength(0);
  });

  it('removes the host when its scope closes', async () => {
    await Effect.runPromise(Scope.close(scope, Exit.void));
    expect(document.querySelector(HOST_TAG)).toBeNull();
  });

  it('main() does nothing on a second injection', () => {
    (globalThis as Record<string, unknown>)[CONTENT_FLAG] = true;
    const before = document.querySelectorAll(HOST_TAG).length;
    main({ resolveAsset: (p) => p });
    expect(document.querySelectorAll(HOST_TAG).length).toBe(before);
    (globalThis as Record<string, unknown>)[CONTENT_FLAG] = false;
  });
});
