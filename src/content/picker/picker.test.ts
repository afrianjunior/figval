import { Effect, Exit, Scope } from 'effect';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeHarness, nextFrame, recordingPort, type Harness } from './test-support';
import { startPicker } from './picker';
import { down, hover, initialPickerState, up } from './picker-state';
import { HOST_TAG } from './overlay-host';

let h: Harness;
let port: ReturnType<typeof recordingPort>;
let finished = 0;

const begin = (): Scope.CloseableScope => {
  const scope = Effect.runSync(Scope.make());
  Effect.runSync(
    startPicker({
      doc: document,
      host: h.host,
      registry: h.registry,
      onFinish: () => void finished++,
    }).pipe(Effect.provide(port.layer), Scope.extend(scope)),
  );
  return scope;
};
const stop = (scope: Scope.CloseableScope) => Effect.runSync(Scope.close(scope, Exit.void));

const mouse = (type: string, el: Element) => {
  const ev = new MouseEvent(type, { bubbles: true, cancelable: true, composed: true });
  el.dispatchEvent(ev);
  return ev;
};
const key = (k: string) => {
  const ev = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
  document.dispatchEvent(ev);
  return ev;
};

beforeEach(() => {
  document.body.innerHTML =
    '<main><section id="s"><p class="lede" id="p">Hello <b id="b">there</b></p></section></main>';
  h = makeHarness();
  port = recordingPort();
  finished = 0;
});
afterEach(() => {
  h.close();
  vi.restoreAllMocks();
});

describe('picker state', () => {
  it('walks up and back down the same path', () => {
    const b = document.getElementById('b')!;
    const s1 = up(hover(initialPickerState, b));
    expect(s1.current?.id).toBe('p');
    expect(up(s1).current?.id).toBe('s');
    expect(down(up(s1)).current?.id).toBe('p');
    expect(down(down(up(s1))).current?.id).toBe('b');
  });
  it('goes to the first child when nothing was stepped over', () => {
    const p = document.getElementById('p')!;
    expect(down(hover(initialPickerState, p)).current?.id).toBe('b');
  });
  it('stops at the document root and at leaves', () => {
    const b = document.getElementById('b')!;
    expect(down(hover(initialPickerState, b)).current).toBe(b);
    const body = document.body;
    expect(up(hover(initialPickerState, body)).current).toBe(body);
    expect(up(initialPickerState)).toBe(initialPickerState);
    expect(down(initialPickerState)).toBe(initialPickerState);
  });
});

describe('startPicker', () => {
  it('adds capture listeners on start and removes them when the scope closes', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    const scope = begin();
    const added = add.mock.calls.map((c) => c[0]);
    expect(added).toEqual(expect.arrayContaining(['pointermove', 'click', 'keydown']));
    stop(scope);
    expect(remove.mock.calls.map((c) => c[0])).toEqual(
      expect.arrayContaining(['pointermove', 'click', 'keydown']),
    );
  });

  it('never intercepts clicks while inactive or after stop', () => {
    const p = document.getElementById('p')!;
    expect(mouse('click', p).defaultPrevented).toBe(false);
    const scope = begin();
    stop(scope);
    expect(mouse('click', p).defaultPrevented).toBe(false);
    expect(port.calls).toHaveLength(0);
  });

  it('draws the hover outline with a tag.class and size chip', async () => {
    const scope = begin();
    mouse('pointermove', document.getElementById('p')!);
    await nextFrame();
    const box = h.host.layer.querySelector<HTMLElement>('.fv-ov-box')!;
    expect(box.hidden).toBe(false);
    expect(box.querySelector('.fv-ov-chip')?.textContent).toContain('p.lede');
    expect(box.querySelector('.fv-ov-chip')?.textContent).toContain('×');
    stop(scope);
    expect(h.host.layer.querySelector('.fv-ov-box')).toBeNull();
  });

  it('click builds a target, opens the tooltip in new mode, and finishes', () => {
    const scope = begin();
    const p = document.getElementById('p')!;
    const ev = mouse('click', p);
    expect(ev.defaultPrevented).toBe(true);
    expect(port.calls).toHaveLength(1);
    expect(port.calls[0]?.opts.mode).toBe('new');
    expect(port.calls[0]?.opts.anchor).toBe(p);
    expect(port.calls[0]?.opts.registry).toBe(h.registry);
    expect(port.calls[0]?.target.classes).toContain('lede');
    expect(finished).toBe(1);
    stop(scope);
  });

  it('Escape cancels without opening a tooltip', () => {
    const scope = begin();
    expect(key('Escape').defaultPrevented).toBe(true);
    expect(finished).toBe(1);
    expect(port.calls).toHaveLength(0);
    stop(scope);
  });

  it('arrow keys move to parent/child and Enter confirms the selection', () => {
    const scope = begin();
    mouse('pointermove', document.getElementById('b')!);
    key('ArrowUp');
    key('Enter');
    expect(port.calls[0]?.opts.anchor.id).toBe('p');
    stop(scope);

    const scope2 = begin();
    mouse('pointermove', document.getElementById('p')!);
    key('ArrowDown');
    mouse('click', document.getElementById('s')!);
    expect(port.calls[1]?.opts.anchor.id).toBe('b');
    stop(scope2);
  });

  it('ignores its own host element', () => {
    const scope = begin();
    const own = document.querySelector(HOST_TAG)!;
    const ev = mouse('click', own);
    expect(ev.defaultPrevented).toBe(false);
    mouse('pointermove', own);
    expect(port.calls).toHaveLength(0);
    stop(scope);
  });
});

describe('startPicker with multiple Figval hosts', () => {
  const secondHost = () => {
    const host = document.createElement(HOST_TAG);
    host.setAttribute('data-fv-host', '');
    const root = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('button');
    root.append(inner);
    document.documentElement.append(host);
    return { host, inner };
  };

  it('ignores clicks and moves inside another host shadow root', async () => {
    const scope = begin();
    const { host, inner } = secondHost();
    mouse('pointermove', inner);
    await nextFrame();
    expect(h.host.layer.querySelector<HTMLElement>('.fv-ov-box')?.hidden).toBe(true);
    expect(mouse('click', inner).defaultPrevented).toBe(false);
    expect(mouse('click', host).defaultPrevented).toBe(false);
    expect(port.calls).toHaveLength(0);
    expect(finished).toBe(0);
    stop(scope);
    host.remove();
  });
});
