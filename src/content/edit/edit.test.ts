import { Effect, Scope, Exit, Stream, Chunk, Fiber } from 'effect';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emptyEdits, type Edits } from '../../domain';
import { activePreviews } from './apply';
import {
  computeBaseline,
  disposeEdits,
  makeEditRegistry,
  pageSwatches,
  preview,
  revert,
  startTextEdit,
  toDiff,
  toHex,
  watchReapply,
  type DraftEdits,
} from './index';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const draftOf = (over: Partial<DraftEdits> = {}): DraftEdits => ({
  text: null,
  style: {},
  hidden: false,
  scope: 'this',
  similarSelector: null,
  similarCount: 0,
  ...over,
});

const setup = (html: string): Document => {
  document.body.innerHTML = html;
  return document;
};

beforeEach(() => setup(''));
afterEach(() => setup(''));

describe('toHex', () => {
  it('normalizes rgb, rgba, hex and names', () => {
    expect(toHex('rgb(255, 0, 128)')).toBe('#FF0080');
    expect(toHex('rgb(0 128 255)')).toBe('#0080FF');
    expect(toHex('rgb(100%, 0%, 0%)')).toBe('#FF0000');
    expect(toHex('rgba(1, 2, 3, 1)')).toBe('#010203');
    expect(toHex('rgba(1, 2, 3, 0.5)')).toBe('rgba(1, 2, 3, 0.5)');
    expect(toHex('rgb(1 2 3 / 50%)')).toBe('rgba(1, 2, 3, 0.5)');
    expect(toHex('#abc')).toBe('#AABBCC');
    expect(toHex('#aabbcc')).toBe('#AABBCC');
    expect(toHex('#aabbccff')).toBe('#AABBCC');
    expect(toHex('#aabbcc80')).toBe('rgba(170, 187, 204, 0.502)');
    expect(toHex('Red')).toBe('#FF0000');
    expect(toHex('transparent')).toBe('rgba(0, 0, 0, 0)');
    expect(toHex('weird')).toBe('weird');
    expect(toHex('rgb(a, b)')).toBe('rgb(a, b)');
    expect(toHex('rgb(a, b, c)')).toBe('rgb(a, b, c)');
  });
});

describe('computeBaseline and toDiff', () => {
  const html =
    '<p id="a" style="color: rgb(10, 20, 30); padding: 8px 16px 12px 16px; font-size: 14px; font-weight: bold; text-align: center; border-radius: 4px; background-color: #fff">Hello</p>' +
    '<div id="b"><span>x</span></div>';

  it('reads computed values with four-side padding', () => {
    setup(html);
    const b = computeBaseline(document.getElementById('a')!);
    expect(b.text).toBe('Hello');
    expect(b.hasEditableText).toBe(true);
    expect(b.padding).toBe('8px 16px 12px 16px');
    expect(b.style.color).toBe('#0A141E');
    expect(b.style['background-color']).toBe('#FFFFFF');
    expect(b.style['font-size']).toBe('14px');
    expect(b.style['font-weight']).toBe('700');
    expect(b.style['padding-block']).toBe('8px 12px');
    expect(b.style['padding-inline']).toBe('16px');
    expect(b.style['text-align']).toBe('center');
    expect(b.style['border-radius']).toBe('4px');
  });

  it('marks elements with element children as not text-editable', () => {
    setup(html);
    const b = computeBaseline(document.getElementById('b')!);
    expect(b.text).toBeNull();
    expect(b.hasEditableText).toBe(false);
  });

  it('keeps only changed properties and the four-side padding before', () => {
    setup(html);
    const b = computeBaseline(document.getElementById('a')!);
    const diff = toDiff(
      b,
      draftOf({
        text: 'Hi',
        style: {
          color: 'rgb(255, 0, 0)',
          'font-size': '14px',
          'padding-block': '20px',
          'background-color': '#ffffff',
        },
      }),
    );
    expect(diff.text).toEqual({ before: 'Hello', after: 'Hi' });
    expect(diff.style).toEqual([
      { property: 'color', before: '#0A141E', after: '#FF0000' },
      { property: 'padding-block', before: '8px 16px 12px 16px', after: '20px' },
    ]);
    expect(diff.hidden).toBe(false);
  });

  it('returns empty edits when nothing changed', () => {
    setup(html);
    const b = computeBaseline(document.getElementById('a')!);
    expect(toDiff(b, draftOf({ text: 'Hello' }))).toEqual(emptyEdits);
  });

  it('drops style changes when hidden and keeps similar scope', () => {
    setup(html);
    const b = computeBaseline(document.getElementById('a')!);
    const diff = toDiff(
      b,
      draftOf({
        hidden: true,
        style: { color: '#ff0000' },
        scope: 'similar',
        similarSelector: 'p',
        similarCount: 3,
      }),
    );
    expect(diff.style).toEqual([]);
    expect(diff).toMatchObject({
      hidden: true,
      scope: 'similar',
      similarSelector: 'p',
      similarCount: 3,
    });
  });

  it('falls back to scope this when similarSelector is missing', () => {
    setup(html);
    const b = computeBaseline(document.getElementById('a')!);
    expect(toDiff(b, draftOf({ scope: 'similar' })).scope).toBe('this');
  });
});

describe('preview and revert', () => {
  const edits = (over: Partial<Edits>): Edits => ({ ...emptyEdits, ...over });

  it('restores a pre-existing inline style exactly', () => {
    setup('<p id="a" style="margin: 2px; color: blue">Hello</p>');
    const el = document.getElementById('a')!;
    const original = el.getAttribute('style');
    preview(
      el,
      edits({
        text: { before: 'Hello', after: 'Bye' },
        style: [{ property: 'color', before: '#0000FF', after: '#FF0000' }],
      }),
      document,
    );
    expect(el.textContent).toBe('Bye');
    expect((el as HTMLElement).style.getPropertyValue('color')).toBe('#FF0000');
    expect((el as HTMLElement).style.getPropertyPriority('color')).toBe('important');
    revert(el, document);
    expect(el.getAttribute('style')).toBe(original);
    expect(el.textContent).toBe('Hello');
  });

  it('removes the style attribute when there was none', () => {
    setup('<p id="a">Hello</p>');
    const el = document.getElementById('a')!;
    preview(el, edits({ hidden: true }), document);
    expect((el as HTMLElement).style.getPropertyValue('display')).toBe('none');
    revert(el, document);
    expect(el.hasAttribute('style')).toBe(false);
  });

  it('replaces the previous preview on re-call', () => {
    setup('<p id="a">Hello</p>');
    const el = document.getElementById('a')!;
    preview(el, edits({ style: [{ property: 'color', before: '', after: '#FF0000' }] }), document);
    preview(el, edits({ style: [{ property: 'font-size', before: '', after: '20px' }] }), document);
    const s = (el as HTMLElement).style;
    expect(s.getPropertyValue('color')).toBe('');
    expect(s.getPropertyValue('font-size')).toBe('20px');
  });

  it('does not set text on elements with element children', () => {
    setup('<div id="a"><b>x</b></div>');
    const el = document.getElementById('a')!;
    preview(el, edits({ text: { before: 'x', after: 'y' } }), document);
    expect(el.innerHTML).toBe('<b>x</b>');
  });

  it('applies style to every match for similar scope and reverts all', () => {
    setup('<li class="r">1</li><li class="r">2</li><li class="r" style="top: 1px">3</li>');
    const [first] = document.querySelectorAll('.r');
    preview(
      first!,
      edits({
        scope: 'similar',
        similarSelector: 'li.r',
        similarCount: 3,
        style: [{ property: 'color', before: '', after: '#FF0000' }],
        text: { before: '1', after: 'one' },
      }),
      document,
    );
    const lis = [...document.querySelectorAll<HTMLElement>('.r')];
    expect(lis.every((l) => l.style.getPropertyValue('color') === '#FF0000')).toBe(true);
    expect(lis.map((l) => l.textContent)).toEqual(['one', '2', '3']);
    revert(first!, document);
    expect(lis.map((l) => l.getAttribute('style'))).toEqual([null, null, 'top: 1px']);
  });

  it('includes the element itself and survives an invalid selector', () => {
    setup('<p id="a">x</p>');
    const el = document.getElementById('a')!;
    preview(el, edits({ scope: 'similar', similarSelector: '[[', hidden: true }), document);
    expect((el as HTMLElement).style.getPropertyValue('display')).toBe('none');
    revert(el, document);
    preview(el, edits({ scope: 'similar', similarSelector: 'span', hidden: true }), document);
    expect((el as HTMLElement).style.getPropertyValue('display')).toBe('none');
    revert(el, document);
  });
});

describe('registry', () => {
  const red: Edits = {
    ...emptyEdits,
    style: [{ property: 'color', before: '', after: '#FF0000' }],
  };
  const hide: Edits = { ...emptyEdits, hidden: true };

  it('applies, turns off, on, and removes', () => {
    setup('<p id="a" style="margin: 1px">x</p>');
    const el = document.getElementById('a') as HTMLElement;
    const reg = makeEditRegistry(document);
    reg.apply('n1', el, red);
    expect(el.style.getPropertyValue('color')).toBe('#FF0000');
    expect(reg.entries()).toEqual([{ noteId: 'n1', edits: red }]);
    expect(reg.elementOf('n1')).toBe(el);
    reg.editsOff();
    expect(reg.isOn()).toBe(false);
    expect(el.getAttribute('style')).toBe('margin: 1px');
    reg.editsOff();
    reg.editsOn();
    expect(el.style.getPropertyValue('color')).toBe('#FF0000');
    reg.editsOn();
    reg.remove('n1');
    reg.remove('missing');
    expect(el.getAttribute('style')).toBe('margin: 1px');
    expect(reg.entries()).toEqual([]);
    expect(reg.elementOf('n1')).toBeNull();
  });

  it('stacks two notes and keeps the other when one is removed', () => {
    setup('<p id="a">x</p>');
    const el = document.getElementById('a') as HTMLElement;
    const reg = makeEditRegistry(document);
    reg.apply('n1', el, red);
    reg.apply('n2', el, hide);
    expect(el.style.getPropertyValue('color')).toBe('#FF0000');
    expect(el.style.getPropertyValue('display')).toBe('none');
    reg.remove('n2');
    expect(el.style.getPropertyValue('display')).toBe('');
    expect(el.style.getPropertyValue('color')).toBe('#FF0000');
  });

  it('records edits while off and paints them on editsOn', () => {
    setup('<p id="a">x</p>');
    const el = document.getElementById('a') as HTMLElement;
    const reg = makeEditRegistry(document);
    reg.editsOff();
    reg.apply('n1', el, red);
    reg.remove('n1');
    reg.apply('n1', el, red);
    expect(el.hasAttribute('style')).toBe(false);
    reg.editsOn();
    expect(el.style.getPropertyValue('color')).toBe('#FF0000');
  });

  it('suspends and resumes an active preview', () => {
    setup('<p id="a">x</p>');
    const el = document.getElementById('a') as HTMLElement;
    const reg = makeEditRegistry(document);
    preview(el, hide, document);
    reg.editsOff();
    expect(el.hasAttribute('style')).toBe(false);
    reg.editsOn();
    expect(el.style.getPropertyValue('display')).toBe('none');
    revert(el, document);
  });
});

describe('watchReapply', () => {
  it('re-applies edits after the element is replaced, and stops after scope close', async () => {
    setup('<ul id="l"><li class="r">1</li></ul>');
    const resolve = (): Element | null => document.querySelector('li.r');
    const reg = makeEditRegistry(document);
    const edits: Edits = {
      ...emptyEdits,
      style: [{ property: 'color', before: '', after: '#FF0000' }],
    };
    reg.apply('n1', resolve()!, edits);

    const scope = Effect.runSync(Scope.make());
    await Effect.runPromise(watchReapply(reg, document, resolve).pipe(Scope.extend(scope)));

    document.getElementById('l')!.innerHTML = '<li class="r">1</li>';
    await sleep(300);
    const fresh = resolve() as HTMLElement;
    expect(fresh.style.getPropertyValue('color')).toBe('#FF0000');
    expect(reg.elementOf('n1')).toBe(fresh);

    await Effect.runPromise(Scope.close(scope, Exit.void));
    document.getElementById('l')!.innerHTML = '<li class="r">1</li>';
    await sleep(300);
    expect((resolve() as HTMLElement).style.getPropertyValue('color')).toBe('');
  });

  it('ignores notes whose element is gone or unchanged', async () => {
    setup('<p class="r">1</p>');
    let found: Element | null = document.querySelector('.r');
    const reg = makeEditRegistry(document);
    reg.apply('n1', found!, { ...emptyEdits, hidden: true });
    const scope = Effect.runSync(Scope.make());
    await Effect.runPromise(watchReapply(reg, document, () => found).pipe(Scope.extend(scope)));
    found = null;
    document.body.append(document.createElement('i'));
    await sleep(250);
    expect(reg.elementOf('n1')).not.toBeNull();
    await Effect.runPromise(Scope.close(scope, Exit.void));
  });
});

describe('startTextEdit', () => {
  it('makes the element editable and restores attributes on release', async () => {
    setup('<p id="a" style="color: red" contenteditable="false">Hello</p>');
    const el = document.getElementById('a') as HTMLElement;
    const before = el.getAttribute('style');
    const scope = Effect.runSync(Scope.make());
    const session = await Effect.runPromise(startTextEdit(el).pipe(Scope.extend(scope)));
    expect(el.getAttribute('contenteditable')).not.toBe('false');
    expect(el.style.getPropertyValue('outline')).toContain('dashed');
    expect(session.current()).toBe('Hello');

    const fiber = Effect.runFork(Stream.runCollect(Stream.take(session.onInput, 1)));
    await sleep(10);
    el.textContent = 'Hello!';
    el.dispatchEvent(new Event('input'));
    const got = await Effect.runPromise(Fiber.join(fiber));
    expect(Chunk.toReadonlyArray(got)).toEqual(['Hello!']);

    await Effect.runPromise(Scope.close(scope, Exit.void));
    expect(el.getAttribute('contenteditable')).toBe('false');
    expect(el.getAttribute('style')).toBe(before);
  });

  it('removes attributes it added when none existed', async () => {
    setup('<p id="a">Hello</p>');
    const el = document.getElementById('a')!;
    const scope = Effect.runSync(Scope.make());
    await Effect.runPromise(startTextEdit(el).pipe(Scope.extend(scope)));
    await Effect.runPromise(Scope.close(scope, Exit.void));
    expect(el.hasAttribute('contenteditable')).toBe(false);
    expect(el.hasAttribute('style')).toBe(false);
  });
});

describe('pageSwatches', () => {
  it('returns distinct hex colors most frequent first, capped by max', () => {
    setup(
      '<p style="color: #111111; background-color: #ffffff">a</p>' +
        '<p style="color: #111111">b</p>' +
        '<p style="color: #222222; background-color: rgba(0,0,0,0.5)">c</p>' +
        '<p data-fv-marker style="color: #999999">m</p>',
    );
    const all = pageSwatches(document);
    expect(all[0]).toBe('#111111');
    expect(new Set(all).size).toBe(all.length);
    expect(all).toContain('#222222');
    expect(all).not.toContain('#999999');
    expect(pageSwatches(document, 1)).toEqual(['#111111']);
  });
});

describe('per-document edit state', () => {
  const hideEdits: Edits = { ...emptyEdits, hidden: true };
  const other = (): Document => {
    const d = document.implementation.createHTMLDocument('other');
    d.body.innerHTML = '<p id="b" style="color: blue">y</p>';
    return d;
  };

  beforeEach(() => disposeEdits(document));

  it('does not share preview state between documents', () => {
    setup('<p id="a">x</p>');
    const d2 = other();
    const a = document.getElementById('a')!;
    const b = d2.getElementById('b')!;
    preview(a, hideEdits, document);
    preview(b, hideEdits, d2);
    expect([...activePreviews(document).keys()]).toEqual([a]);
    expect([...activePreviews(d2).keys()]).toEqual([b]);
    disposeEdits(d2);
    expect(b.getAttribute('style')).toBe('color: blue');
    expect(a.getAttribute('style')).toContain('display');
    expect(activePreviews(document).size).toBe(1);
    disposeEdits(document);
  });

  it('disposeEdits restores every element and empties the store', () => {
    setup('<p id="a" style="margin: 1px">x</p><p id="c">z</p>');
    const a = document.getElementById('a')!;
    const c = document.getElementById('c')!;
    const reg = makeEditRegistry(document);
    preview(a, hideEdits, document);
    reg.apply('n', c, hideEdits);
    disposeEdits(document);
    expect(a.getAttribute('style')).toBe('margin: 1px');
    expect(c.hasAttribute('style')).toBe(false);
    expect(activePreviews(document).size).toBe(0);
    disposeEdits(document);
  });

  it('registry.release reverts everything and empties the registry', () => {
    setup('<p id="a">x</p><p id="c">z</p>');
    const a = document.getElementById('a')!;
    const c = document.getElementById('c')!;
    const reg = makeEditRegistry(document);
    preview(a, hideEdits, document);
    reg.apply('n', c, hideEdits);
    reg.editsOff();
    reg.release();
    expect(a.hasAttribute('style')).toBe(false);
    expect(c.hasAttribute('style')).toBe(false);
    expect(reg.entries()).toEqual([]);
    expect(reg.isOn()).toBe(true);
  });
});
