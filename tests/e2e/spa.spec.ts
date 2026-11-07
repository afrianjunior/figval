import { test, expect } from './fixtures';
import { applyStyleEdit, computed, overlay, pickElement, saveEdit } from './helpers';

test('SPA re-render keeps edits and markers', async ({ harness }) => {
  const { page, tabId } = await harness.openFixture('spa.html');
  const panel = await harness.openPanel(tabId);
  await pickElement(panel, page, 'li.task-item');
  await applyStyleEdit(page, { background: '#ff0000', fontSize: 24 });
  await saveEdit(page);
  const item = 'li.task-item';
  await expect.poll(() => computed(page, item, 'background-color')).toBe('rgb(255, 0, 0)');
  await expect(overlay(page).locator('.fv-slot')).toHaveCount(1);

  await page.evaluate(() => {
    (window as unknown as { __old: Element | null }).__old = document.querySelector('li.task-item');
  });
  await page.getByTestId('rerender').click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { __old: Element }).__old !==
          document.querySelector('li.task-item'),
      ),
    )
    .toBe(true);
  await expect.poll(() => computed(page, item, 'background-color')).toBe('rgb(255, 0, 0)');
  await expect.poll(() => computed(page, item, 'font-size')).toBe('24px');
  await expect(overlay(page).locator('.fv-slot')).toHaveCount(1);
});
