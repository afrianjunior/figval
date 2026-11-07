import { test, expect } from './fixtures';
import {
  applyStyleEdit,
  chooseSimilar,
  computed,
  copyLlm,
  pickElement,
  rows,
  saveEdit,
  setBeforeAfter,
} from './helpers';

test('edit text + style across similar elements, toggle before/after, export graph', async ({
  harness,
}) => {
  const { page, tabId } = await harness.openFixture('static.html');
  const panel = await harness.openPanel(tabId);
  const cta = '[data-testid="hero-cta"]';
  const beforeBg = await computed(page, cta, 'background-color');
  const beforeSize = await computed(page, cta, 'font-size');

  await pickElement(panel, page, cta);
  await applyStyleEdit(page, { text: 'Start free', background: '#ff0000', fontSize: 22 });
  await chooseSimilar(page);
  await saveEdit(page);
  await expect(page.locator(cta)).toHaveText('Start free');
  await expect.poll(() => computed(page, cta, 'background-color')).toBe('rgb(255, 0, 0)');
  await expect.poll(() => computed(page, '[data-testid="nav-signup"]', 'font-size')).toBe('22px');

  await setBeforeAfter(panel, 'before');
  await expect.poll(() => computed(page, cta, 'background-color')).toBe(beforeBg);
  await expect.poll(() => computed(page, cta, 'font-size')).toBe(beforeSize);
  await setBeforeAfter(panel, 'after');
  await expect.poll(() => computed(page, cta, 'background-color')).toBe('rgb(255, 0, 0)');

  await pickElement(panel, page, 'a.btn-primary[href="#contact"]');
  await applyStyleEdit(page, { background: '#00aa00', fontSize: 18 });
  await saveEdit(page);
  await panel.bringToFront();
  await expect(rows(panel)).toHaveCount(2);

  const md = await copyLlm(panel, harness.readClipboard);
  expect(md).toContain('| Property | Before | After |');
  expect(md).toContain('## Execution graph');
});
