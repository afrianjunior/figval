import { Effect, Exit, Layer, Scope } from 'effect';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyEdits, type Note } from '../../domain';
import { makeMessengerLoopback, Messenger } from '../../messaging';
import { SessionStore, SessionStoreMemory } from '../../storage';
import { TooltipPort } from '../picker';
import { makeHarness, noteFor, recordingPort, type Harness } from '../picker/test-support';
import { makeMarkerLayer, HOVER_KEY, type MarkerLayer } from './markers';

let h: Harness;
let port: ReturnType<typeof recordingPort>;
let reports: Array<readonly string[]>;
let layer: MarkerLayer;
let scope: Scope.CloseableScope;
let run: <A>(e: Effect.Effect<A, unknown, Messenger | SessionStore | TooltipPort>) => Promise<A>;

const pins = () => [...h.host.layer.querySelectorAll<HTMLElement>('.fv-slot')];
const styleEdits = {
  ...emptyEdits,
  style: [{ property: 'color' as const, before: 'red', after: 'blue' }],
};

beforeEach(async () => {
  document.body.innerHTML =
    '<main><h1 id="a" class="hero">Title</h1><button id="b" class="cta">Buy</button></main>';
  h = makeHarness();
  port = recordingPort();
  reports = [];
  const services = Layer.mergeAll(makeMessengerLoopback(), SessionStoreMemory(), port.layer);
  scope = Effect.runSync(Scope.make());
  const ctx = await Effect.runPromise(Layer.buildWithScope(services, scope));
  run = (e) => Effect.runPromise(e.pipe(Effect.provide(ctx)));
  await run(
    Effect.gen(function* () {
      const m = yield* Messenger;
      yield* m.serve('background', (req) =>
        Effect.sync(() => {
          if (req._tag === 'MissingReport') reports.push(req.ids);
        }),
      );
      layer = yield* makeMarkerLayer({ doc: document, host: h.host, registry: h.registry });
    }).pipe(Scope.extend(scope)),
  );
});
afterEach(() => {
  Effect.runSync(Scope.close(scope, Exit.void));
  h.close();
});

describe('markers', () => {
  it('renders one pin per found note labelled FV-n and reports the missing ones', async () => {
    const a = document.getElementById('a')!;
    const b = document.getElementById('b')!;
    const ghost: Note = {
      ...noteFor(b, 3),
      target: { ...noteFor(b, 3).target, selector: '#nope', attrs: {}, text: 'zzz', domPath: [] },
    };
    await run(layer.render([noteFor(a, 1), noteFor(b, 2), ghost]));
    expect(pins().map((p) => p.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining('FV-1')]),
    );
    expect(pins()).toHaveLength(2);
    expect(pins()[1]?.textContent).toContain('FV-2');
    expect(pins()[0]?.querySelector('[role="tooltip"]')?.textContent).toBe('comment 1');
    await vi.waitFor(() => expect(reports).toEqual([[ghost.id]]));
  });

  it('clears pins and applies/removes edits through the registry', async () => {
    const a = document.getElementById('a')!;
    await run(layer.render([noteFor(a, 1, styleEdits)]));
    expect(h.registry.entries().map((e) => e.noteId)).toHaveLength(1);
    expect(h.registry.elementOf(noteFor(a, 1).id)).toBe(a);
    await run(layer.render([noteFor(a, 1)]));
    expect(h.registry.entries()).toHaveLength(0);
    await run(layer.clear);
    expect(pins()).toHaveLength(0);
  });

  it('click on a pin reopens the tooltip for that note', async () => {
    const a = document.getElementById('a')!;
    const n = noteFor(a, 1);
    await run(layer.render([n]));
    pins()[0]!.querySelector('button')!.click();
    expect(port.calls).toHaveLength(1);
    expect(port.calls[0]?.opts).toMatchObject({ mode: 'reopen', noteId: n.id, anchor: a });
  });

  it('hover writes the session hover key and clears it on leave', async () => {
    const a = document.getElementById('a')!;
    const n = noteFor(a, 1);
    await run(layer.render([n]));
    const read = () => run(Effect.flatMap(SessionStore, (s) => s.get(HOVER_KEY)));
    const btn = pins()[0]!.querySelector('button')!;
    btn.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
    btn.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await vi.waitFor(async () => expect(await read()).toMatchObject({ noteId: n.id }));
    btn.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await vi.waitFor(async () => expect(await read()).toBeNull());
  });

  it('highlight emphasises the pin and outlines the element; null removes it', async () => {
    const a = document.getElementById('a')!;
    const n = noteFor(a, 1);
    await run(layer.render([n]));
    await run(layer.highlight(n.id));
    expect(h.host.layer.querySelector('.fv-pin--active')).not.toBeNull();
    expect(h.host.layer.querySelector<HTMLElement>('.fv-ov-box--note')?.hidden).toBe(false);
    await run(layer.highlight(null));
    expect(h.host.layer.querySelector('.fv-pin--active')).toBeNull();
    expect(h.host.layer.querySelector<HTMLElement>('.fv-ov-box--note')?.hidden).toBe(true);
  });

  it('scrollTo centres the element and pulses', async () => {
    const a = document.getElementById('a')!;
    const spy = vi.fn();
    a.scrollIntoView = spy;
    const n = noteFor(a, 1);
    await run(layer.render([n]));
    await run(layer.scrollTo(n.id));
    expect(spy).toHaveBeenCalledWith({ block: 'center' });
    expect(h.host.layer.querySelector<HTMLElement>('.fv-ov-box--pulse')?.hidden).toBe(false);
  });

  it('positions pins at the element top-right and follows scroll', async () => {
    const a = document.getElementById('a')!;
    a.getBoundingClientRect = () => ({
      left: 10,
      right: 210,
      top: 100,
      bottom: 140,
      width: 200,
      height: 40,
      x: 10,
      y: 100,
      toJSON: () => ({}),
    });
    await run(layer.render([noteFor(a, 1)]));
    expect(pins()[0]?.style.transform).toBe('translate(202px, 76px)');
    a.getBoundingClientRect = () => ({
      left: 10,
      right: 210,
      top: 300,
      bottom: 340,
      width: 200,
      height: 40,
      x: 10,
      y: 300,
      toJSON: () => ({}),
    });
    window.dispatchEvent(new Event('scroll'));
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(pins()[0]?.style.transform).toBe('translate(202px, 276px)');
  });

  it('sends an empty MissingReport when a later render has no notes', async () => {
    const b = document.getElementById('b')!;
    const ghost: Note = {
      ...noteFor(b, 3),
      target: { ...noteFor(b, 3).target, selector: '#nope', attrs: {}, text: 'zzz', domPath: [] },
    };
    await run(layer.render([ghost]));
    await vi.waitFor(() => expect(reports).toEqual([[ghost.id]]));
    await run(layer.render([]));
    await vi.waitFor(() => expect(reports).toEqual([[ghost.id], []]));
  });

  it('flags slots near the right and top edges with data-edge', async () => {
    const a = document.getElementById('a')!;
    const rectAt = (left: number, right: number, top: number) => () => ({
      left,
      right,
      top,
      bottom: top + 40,
      width: right - left,
      height: 40,
      x: left,
      y: top,
      toJSON: () => ({}),
    });
    a.getBoundingClientRect = rectAt(10, window.innerWidth, 20);
    await run(layer.render([noteFor(a, 1)]));
    expect(pins()[0]?.dataset.edge?.split(' ').sort()).toEqual(['below', 'right']);
    a.getBoundingClientRect = rectAt(10, 210, 300);
    window.dispatchEvent(new Event('scroll'));
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(pins()[0]?.dataset.edge ?? '').toBe('');
  });

  describe('preview flip uses measured height', () => {
    const topRect = (top: number) => () => ({
      left: 10,
      right: 210,
      top,
      bottom: top + 40,
      width: 200,
      height: 40,
      x: 10,
      y: top,
      toJSON: () => ({}),
    });
    const stubPreview = (height: number) => {
      const preview = pins()[0]?.querySelector('.fv-pin__preview') as HTMLElement;
      preview.getBoundingClientRect = () => ({ height }) as DOMRect;
    };

    it('keeps a short preview above when it fits', async () => {
      const a = document.getElementById('a')!;
      a.getBoundingClientRect = topRect(70);
      await run(layer.render([noteFor(a, 1)]));
      stubPreview(20);
      pins()[0]?.querySelector('.fv-pin__btn')?.dispatchEvent(new Event('pointerover', { bubbles: true }));
      expect(pins()[0]?.dataset.edge ?? '').toBe('');
    });

    it('flips a tall preview below at y=42 once hovered', async () => {
      const a = document.getElementById('a')!;
      a.getBoundingClientRect = topRect(66);
      await run(layer.render([noteFor(a, 1)]));
      stubPreview(60);
      pins()[0]?.querySelector('.fv-pin__btn')?.dispatchEvent(new Event('pointerover', { bubbles: true }));
      expect(pins()[0]?.dataset.edge?.split(' ')).toContain('below');
    });
  });
});
