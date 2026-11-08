import { describe, expect, it } from 'vitest';
import { baselineFixture } from './fixtures';
import { initialState, reduce, type TooltipState } from './state';
import { canSave, changedProps, diffOf, isDirty, showForceApply, styleValue } from './selectors';

const start = (over: Partial<Parameters<typeof initialState>[0]> = {}): TooltipState =>
  initialState({
    seq: 3,
    mode: 'new',
    tab: 'comment',
    baseline: baselineFixture,
    similar: { selector: 'button.btn', count: 4 },
    ...over,
  });

describe('tooltip reducer', () => {
  it('shows the first-note hint only when asked, and hides it without dirtying the note', () => {
    expect(start().showHint).toBe(false);
    const hinted = start({ showHint: true });
    const hidden = reduce(hinted, { type: 'dismissHint' });
    expect(hidden.showHint).toBe(false);
    expect(isDirty(hidden)).toBe(false);
  });

  it('starts empty and clean', () => {
    const s = start();
    expect(isDirty(s)).toBe(false);
    expect(canSave(s)).toBe(false);
    expect(s.escArmed).toBe(false);
  });

  it('enables Save for a non-blank comment', () => {
    expect(canSave(reduce(start(), { type: 'comment', value: '  ' }))).toBe(false);
    expect(canSave(reduce(start(), { type: 'comment', value: 'Bigger' }))).toBe(true);
  });

  it('enables Save for a single edit without a comment', () => {
    const s = reduce(start(), { type: 'style', prop: 'font-size', value: '18px' });
    expect(canSave(s)).toBe(true);
    expect(diffOf(s).style).toHaveLength(1);
  });

  it('ignores a style value equal to the baseline', () => {
    const s = reduce(start(), { type: 'style', prop: 'font-size', value: '14px' });
    expect(canSave(s)).toBe(false);
  });

  it('disables Save while saving', () => {
    const s = reduce(reduce(start(), { type: 'comment', value: 'x' }), { type: 'saving' });
    expect(canSave(s)).toBe(false);
  });

  it('hides force-apply once any edit exists', () => {
    const s = start();
    expect(showForceApply(s)).toBe(true);
    expect(showForceApply(reduce(s, { type: 'hidden', value: true }))).toBe(false);
  });

  it('drops style edits from the diff when hidden', () => {
    const s = reduce(reduce(start(), { type: 'style', prop: 'color', value: '#ff0000' }), {
      type: 'hidden',
      value: true,
    });
    expect(diffOf(s).style).toEqual([]);
    expect(diffOf(s).hidden).toBe(true);
  });

  it('tracks changed props and resets one or all', () => {
    let s = reduce(start(), { type: 'style', prop: 'color', value: '#ff0000' });
    s = reduce(s, { type: 'style', prop: 'border-radius', value: '12px' });
    s = reduce(s, { type: 'text', value: 'Go' });
    expect([...changedProps(s)].sort()).toEqual(['border-radius', 'color']);
    s = reduce(s, { type: 'resetStyle', props: ['color'] });
    expect([...changedProps(s)]).toEqual(['border-radius']);
    s = reduce(s, { type: 'resetAll' });
    expect(diffOf(s).text).toBeNull();
    expect(changedProps(s).size).toBe(0);
    expect(styleValue(s, 'color')).toBe('#111111');
  });

  it('keeps the comment on resetAll', () => {
    const s = reduce(reduce(start(), { type: 'comment', value: 'keep' }), { type: 'resetAll' });
    expect(s.comment).toBe('keep');
  });

  it('records scope with similar selector and count', () => {
    const s = reduce(reduce(start(), { type: 'style', prop: 'color', value: '#ff0000' }), {
      type: 'scope',
      value: 'similar',
    });
    expect(diffOf(s)).toMatchObject({
      scope: 'similar',
      similarSelector: 'button.btn',
      similarCount: 4,
    });
  });

  it('arms Esc only when dirty, and disarms on further input', () => {
    const clean = reduce(start(), { type: 'escape' });
    expect(clean.escArmed).toBe(false);
    const dirty = reduce(start(), { type: 'comment', value: 'x' });
    const armed = reduce(dirty, { type: 'escape' });
    expect(armed.escArmed).toBe(true);
    expect(reduce(armed, { type: 'comment', value: 'xy' }).escArmed).toBe(false);
  });

  it('keeps content and records the tag on save failure', () => {
    let s = reduce(start(), { type: 'comment', value: 'keep me' });
    s = reduce(s, { type: 'saving' });
    s = reduce(s, { type: 'saveFailed', tag: 'StorageQuotaExceeded' });
    expect(s.comment).toBe('keep me');
    expect(s.saving).toBe(false);
    expect(s.error).toBe('StorageQuotaExceeded');
    expect(reduce(s, { type: 'comment', value: 'keep me!' }).error).toBeNull();
  });

  it('shows the reason field once opened', () => {
    expect(reduce(start(), { type: 'showWhy' }).showWhy).toBe(true);
    expect(start({ why: 'because' }).showWhy).toBe(true);
  });

  it('is clean when reopening an existing note unchanged', () => {
    const edits = {
      text: null,
      style: [{ property: 'color' as const, before: '#111111', after: '#ff0000' }],
      hidden: false,
      scope: 'this' as const,
      similarSelector: null,
      similarCount: 0,
    };
    const s = start({ mode: 'reopen', comment: 'c', edits });
    expect(isDirty(s)).toBe(false);
    expect(styleValue(s, 'color')).toBe('#ff0000');
    expect(isDirty(reduce(s, { type: 'comment', value: 'd' }))).toBe(true);
  });

  it('hydrates from a resumed draft', () => {
    const s = reduce(start(), {
      type: 'hydrate',
      snapshot: {
        label: 'L',
        comment: 'from draft',
        why: '',
        showWhy: false,
        forceApply: true,
        tab: 'edit',
        text: null,
        style: { color: '#00ff00' },
        hidden: false,
        scope: 'this',
      },
    });
    expect(s.comment).toBe('from draft');
    expect(s.tab).toBe('edit');
    expect(styleValue(s, 'color')).toBe('#00ff00');
  });

  it('flags element status', () => {
    expect(reduce(start(), { type: 'elementStatus', value: 'gone' }).elementStatus).toBe('gone');
  });

  it('ignores edits for Save when the element is gone', () => {
    let s = reduce(start(), { type: 'style', prop: 'color', value: '#ff0000' });
    s = reduce(s, { type: 'elementStatus', value: 'gone' });
    expect(canSave(s)).toBe(false);
    expect(canSave(reduce(s, { type: 'comment', value: 'still ok' }))).toBe(true);
  });
});
