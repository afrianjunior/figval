import { describe, expect, it } from 'vitest';
import { Effect, Exit } from 'effect';
import { ElementNotFound, NoteId } from '../domain';
import {
  autoLabel,
  buildTarget,
  childTarget,
  findElement,
  findElementEffect,
  findSimilar,
  isHashedClass,
  nearestBlock,
  parentTarget,
  stableClasses,
  trimHtml,
  uniqueSelector,
} from './index';
import { loadFixture } from './fixtures';

const $ = (doc: Document, sel: string): Element => {
  const el = doc.querySelector(sel);
  if (!el) throw new Error(`missing ${sel}`);
  return el;
};

describe('isHashedClass / stableClasses', () => {
  it('flags generated class names', () => {
    for (const c of ['css-1x2y3z', 'sc-abc123', 'jsx-123', 'emotion-0', 'a1b2c3d4']) {
      expect(isHashedClass(c)).toBe(true);
    }
  });
  it('keeps human class names', () => {
    for (const c of ['btn-primary', 'save-button', 'hero__inner', 'promo-banner', 'container']) {
      expect(isHashedClass(c)).toBe(false);
    }
  });
  it('filters hashed classes from an element', () => {
    const doc = loadFixture('hashed-classes.html');
    expect(stableClasses($(doc, '.save-button'))).toEqual(['save-button']);
    expect(stableClasses($(doc, 'h1'))).toEqual([]);
  });
});

describe('uniqueSelector', () => {
  const doc = loadFixture('static.html');
  it('prefers data-testid', () => {
    expect(uniqueSelector($(doc, '[data-testid="hero-cta"]'), doc)).toBe(
      '[data-testid="hero-cta"]',
    );
  });
  it('uses a stable id when unique', () => {
    expect(uniqueSelector($(doc, '#pricing-heading'), doc)).toBe('#pricing-heading');
  });
  it('builds a unique chain for elements without testid', () => {
    const el = $(doc, '.hero__lede');
    const sel = uniqueSelector(el, doc);
    expect(doc.querySelectorAll(sel)).toHaveLength(1);
    expect(doc.querySelector(sel)).toBe(el);
  });
  it('is unique for every element in the document', () => {
    for (const el of Array.from(doc.body.querySelectorAll('*'))) {
      const sel = uniqueSelector(el, doc);
      expect(doc.querySelectorAll(sel)).toHaveLength(1);
      expect(doc.querySelector(sel)).toBe(el);
    }
  });
  it('is unique on hashed-class documents', () => {
    const hashed = loadFixture('hashed-classes.html');
    for (const el of Array.from(hashed.body.querySelectorAll('*'))) {
      const sel = uniqueSelector(el, hashed);
      expect(hashed.querySelector(sel)).toBe(el);
      expect(sel).not.toMatch(/css-|sc-/);
    }
  });
  it('falls back to nth-of-type when classes cannot disambiguate', () => {
    const d = loadFixture('static.html');
    d.body.innerHTML = '<ul><li>a</li><li>b</li><li>c</li></ul>';
    const li = d.querySelectorAll('li')[1] as Element;
    const sel = uniqueSelector(li, d);
    expect(sel).toContain(':nth-of-type(2)');
    expect(d.querySelector(sel)).toBe(li);
  });
  it('ignores a hashed id and escapes odd ids', () => {
    const d = loadFixture('static.html');
    d.body.innerHTML = '<div id="a1b2c3d4"><p id="we:ird.id">x</p></div>';
    const p = $(d, 'p');
    const sel = uniqueSelector(p, d);
    expect(d.querySelector(sel)).toBe(p);
    expect(uniqueSelector($(d, 'div'), d)).not.toContain('a1b2c3d4');
  });
  it('escapes testid quotes', () => {
    const d = loadFixture('static.html');
    d.body.innerHTML = "<p data-testid='a\"b'>x</p>";
    const p = $(d, 'p');
    expect(d.querySelector(uniqueSelector(p, d))).toBe(p);
  });
});

describe('findSimilar', () => {
  it('counts elements sharing tag and stable classes', () => {
    const doc = loadFixture('static.html');
    const r = findSimilar($(doc, '[data-testid="hero-cta"]'), doc);
    expect(r).toEqual({ selector: 'a.btn-primary', count: 4 });
  });
  it('skips hashed classes', () => {
    const doc = loadFixture('hashed-classes.html');
    expect(findSimilar($(doc, '.save-button'), doc)).toEqual({
      selector: 'button.save-button',
      count: 1,
    });
  });
  it('falls back to the unique selector when no stable classes', () => {
    const doc = loadFixture('hashed-classes.html');
    const h1 = $(doc, 'h1');
    expect(findSimilar(h1, doc)).toEqual({ selector: uniqueSelector(h1, doc), count: 1 });
  });
  it('matches pricing descriptions', () => {
    const doc = loadFixture('static.html');
    expect(findSimilar($(doc, '.plan-desc'), doc).count).toBe(3);
  });
});

describe('autoLabel', () => {
  const doc = loadFixture('static.html');
  it('uses aria-label first', () => {
    expect(autoLabel($(doc, 'nav'))).toBe('Main navigation');
  });
  it('combines text with a role noun', () => {
    expect(autoLabel($(doc, '[data-testid="hero-cta"]'))).toBe('Get started link');
    expect(autoLabel($(doc, 'h1'))).toBe('Build faster with Acme heading');
  });
  it('labels buttons and labels and images and inputs', () => {
    const d = loadFixture('static.html');
    d.body.innerHTML =
      '<button>Sign-up</button><label>Email</label><img alt="Logo"><input placeholder="Search"><div role="button">Go</div><img><input name="q"><input>';
    const ls = Array.from(d.body.children).map(autoLabel);
    expect(ls).toEqual([
      'Sign-up button',
      'Email label',
      'Logo image',
      'Search input',
      'Go button',
      'Image',
      'Q input',
      'Input',
    ]);
  });
  it('humanizes generic container classes', () => {
    expect(autoLabel($(doc, '.promo-banner'))).toBe('Promo banner');
  });
  it('falls back to the tag', () => {
    const d = loadFixture('hashed-classes.html');
    expect(autoLabel($(d, 'body > div'))).toBe('div');
  });
  it('clips long text under 40 chars', () => {
    const d = loadFixture('static.html');
    d.body.innerHTML = `<a>${'long '.repeat(30)}</a>`;
    expect(autoLabel($(d, 'a')).length).toBeLessThanOrEqual(40);
  });
});

describe('trimHtml', () => {
  it('returns short html unchanged', () => {
    const doc = loadFixture('static.html');
    const el = $(doc, '.hero__lede');
    expect(trimHtml(el, 2048)).toBe(el.outerHTML);
  });
  it('collapses children and never exceeds max', () => {
    const doc = loadFixture('static.html');
    const el = $(doc, 'main');
    const out = trimHtml(el, 120);
    expect(out.length).toBeLessThanOrEqual(120);
    expect(out.startsWith('<main')).toBe(true);
    expect(out.endsWith('</main>')).toBe(true);
  });
  it('hard-cuts when even the opening tag is too long', () => {
    const doc = loadFixture('static.html');
    const el = $(doc, '[data-testid="hero-cta"]');
    expect(trimHtml(el, 10)).toHaveLength(10);
  });
  it('strips Figval markers', () => {
    const doc = loadFixture('static.html');
    const el = $(doc, '.hero__lede');
    el.setAttribute('data-fv-id', '1');
    el.setAttribute('contenteditable', 'true');
    const out = trimHtml(el, 2048);
    expect(out).not.toContain('data-fv');
    expect(out).not.toContain('contenteditable');
    expect(el.getAttribute('data-fv-id')).toBe('1');
  });
  it('keeps void elements without a close tag', () => {
    const doc = loadFixture('static.html');
    doc.body.innerHTML = '<img alt="a very long alt text here" src="x.png">';
    const out = trimHtml($(doc, 'img'), 20);
    expect(out.length).toBeLessThanOrEqual(20);
  });
});

describe('buildTarget', () => {
  const doc = loadFixture('static.html');
  it('describes a hero CTA', () => {
    const el = $(doc, '[data-testid="hero-cta"]');
    const t = buildTarget(el);
    expect(t.kind).toBe('element');
    expect(t.text).toBe('Get started');
    expect(t.label).toBe('Get started link');
    expect(t.attrs).toEqual({ testid: 'hero-cta' });
    expect(t.classes).toEqual(['btn-primary']);
    expect(t.selector).toBe('[data-testid="hero-cta"]');
    expect(t.state).toBe('rest');
    expect(t.selection).toBeNull();
    expect(t.html).toContain('hero-cta');
    expect(t.domPath.map((s) => s.tag)).toEqual(['section', 'div', 'a']);
    expect(t.domPath[0]).toMatchObject({ tag: 'section', classes: ['hero'] });
    expect(t.domPath[2]).toMatchObject({ tag: 'a', testid: 'hero-cta' });
  });
  it('records id, aria-label, role, name and state override', () => {
    const d = loadFixture('static.html');
    d.body.innerHTML = '<main><input id="e" aria-label="Email" role="textbox" name="email"></main>';
    const t = buildTarget($(d, 'input'), undefined, { state: 'focus' });
    expect(t.attrs).toEqual({ id: 'e', ariaLabel: 'Email', role: 'textbox', name: 'email' });
    expect(t.state).toBe('focus');
  });
  it('trims text to 200 chars', () => {
    const d = loadFixture('static.html');
    d.body.innerHTML = `<p>${'x'.repeat(500)}</p>`;
    expect(buildTarget($(d, 'p')).text).toHaveLength(200);
  });
  it('keeps only the last 6 steps', () => {
    const d = loadFixture('static.html');
    d.body.innerHTML =
      '<main><div><div><div><div><div><div><span>x</span></div></div></div></div></div></div></main>';
    const t = buildTarget($(d, 'span'));
    expect(t.domPath).toHaveLength(6);
    expect(t.domPath.at(-1)?.tag).toBe('span');
  });
  it('starts at body children when there is no landmark', () => {
    const d = loadFixture('hashed-classes.html');
    const t = buildTarget($(d, '.save-button'));
    expect(t.domPath.map((s) => s.tag)).toEqual(['div', 'button']);
    expect(t.domPath[1]).toMatchObject({ nth: 1 });
  });
  it('omits nth when siblings do not share the tag', () => {
    const t = buildTarget($(doc, '.hero__lede'));
    expect(t.domPath.at(-1)?.nth).toBeUndefined();
  });
  it('recognises role landmarks', () => {
    const d = loadFixture('static.html');
    d.body.innerHTML = '<div role="navigation"><p>x</p></div>';
    expect(buildTarget($(d, 'p')).domPath.map((s) => s.tag)).toEqual(['div', 'p']);
  });
  it('builds a text target with context', () => {
    const d = document; // happy-dom ranges only behave inside the global document
    const before = 'a'.repeat(100);
    const after = 'b'.repeat(100);
    d.body.innerHTML = `<main><p>${before} chosen words ${after}</p></main>`;
    const p = $(d, 'p');
    const textNode = p.firstChild as Text;
    const start = before.length + 1;
    const range = d.createRange();
    range.setStart(textNode, start);
    range.setEnd(textNode, start + 'chosen words'.length);
    const t = buildTarget(p, range);
    expect(t.kind).toBe('text');
    expect(t.selection?.text).toBe('chosen words');
    expect(t.selection?.before).toHaveLength(80);
    expect(t.selection?.before.endsWith(' ')).toBe(true);
    expect(t.selection?.after).toHaveLength(80);
    expect(t.selection?.after.startsWith(' ')).toBe(true);
  });
  it('falls back to empty context when the selection is not found', () => {
    const d = document;
    d.body.innerHTML = '<p>hello</p>';
    const p = $(d, 'p');
    const other = d.createElement('i');
    other.textContent = 'zzz';
    d.body.appendChild(other);
    const range = d.createRange();
    range.selectNodeContents(other);
    const t = buildTarget(p, range);
    expect(t.selection).toEqual({ text: 'zzz', before: '', after: '' });
  });
});

describe('nearestBlock / parent / child', () => {
  const doc = loadFixture('static.html');
  it('climbs from a text node to its block', () => {
    const lede = $(doc, '.hero__lede');
    expect(nearestBlock(lede.firstChild as Node)).toBe(lede);
  });
  it('climbs from inline elements', () => {
    const d = loadFixture('static.html');
    d.body.innerHTML = '<p>a <b>bold</b></p>';
    expect(nearestBlock($(d, 'b'))).toBe($(d, 'p'));
  });
  it('falls back to body for detached inline nodes', () => {
    const d = loadFixture('static.html');
    d.body.innerHTML = '<span>x</span>';
    expect(nearestBlock($(d, 'span'))).toBe(d.body);
  });
  it('moves to parent and child targets', () => {
    const cta = $(doc, '[data-testid="hero-cta"]');
    expect(parentTarget(cta)?.classes).toEqual(['hero__inner']);
    expect(childTarget($(doc, '.hero__inner'))?.text).toBe('Build faster with Acme');
    expect(childTarget(cta)).toBeNull();
    expect(parentTarget(doc.body)).toBeNull();
  });
});

describe('findElement', () => {
  const doc = loadFixture('static.html');
  const cta = $(doc, '[data-testid="hero-cta"]');
  const base = buildTarget(cta);

  it('finds by testid', () => {
    expect(findElement(base, doc)).toBe(cta);
  });
  it('finds by id when testid is missing', () => {
    const t = buildTarget($(doc, '#pricing-heading'));
    expect(findElement({ ...t, attrs: { id: 'pricing-heading' }, selector: 'zzz' }, doc)).toBe(
      $(doc, '#pricing-heading'),
    );
  });
  it('skips a non-unique testid', () => {
    const d = loadFixture('static.html');
    d.body.innerHTML = '<p data-testid="x">a</p><p data-testid="x">b</p><p class="only">a</p>';
    const t = { ...base, attrs: { testid: 'x' }, selector: '.only', text: 'zzz' };
    expect(findElement(t, d)).toBe($(d, '.only'));
  });
  it('finds by selector', () => {
    const t = { ...base, attrs: {} };
    expect(findElement(t, doc)).toBe(cta);
  });
  it('finds by text and tag', () => {
    const t = { ...base, attrs: {}, selector: '.gone' };
    expect(findElement(t, doc)).toBe(cta);
  });
  it('finds by domPath', () => {
    const t = { ...base, attrs: {}, selector: '.gone', text: 'changed text' };
    expect(findElement(t, doc)).toBe(cta);
  });
  it('finds by domPath with ids and nth', () => {
    const d = loadFixture('static.html');
    d.body.innerHTML = '<main><div id="w"><p>a</p><p>b</p></div></main>';
    const p2 = d.querySelectorAll('p')[1] as Element;
    const t = { ...buildTarget(p2), attrs: {}, selector: '.gone', text: 'nope' };
    expect(findElement(t, d)).toBe(p2);
  });
  it('returns null when nothing matches', () => {
    const t = {
      ...base,
      attrs: { testid: 'nope', id: 'nope' },
      selector: '.gone',
      text: 'nope',
      domPath: [],
    };
    expect(findElement(t, doc)).toBeNull();
  });
  it('returns null for ambiguous domPath', () => {
    const t = {
      ...base,
      attrs: {},
      selector: '.gone',
      text: 'nope',
      domPath: [{ tag: 'a', classes: [] }],
    };
    expect(findElement(t, doc)).toBeNull();
  });
  it('survives invalid selectors', () => {
    const t = { ...base, attrs: {}, selector: '>>>', text: 'nope', domPath: [] };
    expect(findElement(t, doc)).toBeNull();
  });
  it('wraps the result in Effect', async () => {
    const noteId = '00000000-0000-4000-8000-000000000000' as NoteId;
    const ok = await Effect.runPromise(findElementEffect(base, doc, noteId));
    expect(ok).toBe(cta);
    const miss = {
      ...base,
      attrs: { testid: 'nope' },
      selector: '.gone',
      text: 'nope',
      domPath: [],
    };
    const exit = await Effect.runPromiseExit(findElementEffect(miss, doc, noteId));
    expect(Exit.isFailure(exit)).toBe(true);
    expect(JSON.stringify(exit)).toContain('ElementNotFound');
    expect(new ElementNotFound({ noteId })._tag).toBe('ElementNotFound');
  });
});
