import { resolve } from 'node:path';
import { test, expect } from './fixtures';
import { commentAndSave, overlay, pickElement, rows } from './helpers';

const DIR = resolve(import.meta.dirname, '__screenshots__');
const WIDTHS = [320, 360, 420] as const;
const SCHEMES = ['light', 'dark'] as const;

test('screenshots: panel widths and tooltip, light and dark', async ({ harness }) => {
  const { page, tabId } = await harness.openFixture('static.html');
  const panel = await harness.openPanel(tabId);
  await pickElement(panel, page, '[data-testid="hero-cta"]');
  await commentAndSave(page, 'Make the CTA calmer');
  await pickElement(panel, page, '[data-testid="promo-banner"]');
  await commentAndSave(page, 'Banner copy is too loud');
  await panel.bringToFront();
  await expect(rows(panel)).toHaveCount(2);

  for (const scheme of SCHEMES) {
    await panel.emulateMedia({ colorScheme: scheme });
    for (const width of WIDTHS) {
      await panel.setViewportSize({ width, height: 800 });
      await expect(rows(panel)).toHaveCount(2);
      await panel.screenshot({ path: `${DIR}/panel-${width}-${scheme}.png` });
    }
  }

  await panel.bringToFront();
  for (const scheme of SCHEMES) {
    await page.emulateMedia({ colorScheme: scheme });
    await pickElement(panel, page, 'p.plan-desc');
    const tip = overlay(page).locator('.fv-tip').first();
    await expect
      .poll(() => tip.evaluate((el) => getComputedStyle(el).opacity), { timeout: 5_000 })
      .toBe('1');
    await page.screenshot({ path: `${DIR}/tooltip-${scheme}.png` });
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
  }
});
