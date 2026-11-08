import { resolve } from 'node:path';
import type { BrowserContext, Page } from '@playwright/test';
import { test, expect, copy } from './fixtures';
import { commentAndSave, commentBox, overlay, pickElement, rows, settle } from './helpers';

const DIR = resolve(import.meta.dirname, '__screenshots__');
const WELCOME_WIDTHS = [320, 768, 1024, 1440] as const;
const SCHEMES = ['light', 'dark'] as const;
const w = copy.welcome;
const c = copy.panel.checklist;

/** The install opens welcome.html by itself; find it among the context's pages. */
const welcomePage = async (context: BrowserContext): Promise<Page> => {
  const find = () => context.pages().find((p) => p.url().endsWith('/welcome.html'));
  await expect.poll(() => find() !== undefined, { timeout: 10_000 }).toBe(true);
  const page = find() as Page;
  await expect(page.getByRole('heading', { level: 1, name: w.title })).toBeVisible();
  return page;
};

test('install opens the welcome tab; choosing a preset saves it', async ({ context, harness }) => {
  const page = await welcomePage(context);
  await expect(page.getByRole('listitem')).toHaveCount(3);
  await expect(page.getByText(w.progress(0, 3))).toBeVisible();

  // Users click the card; the native radio inside it is visually hidden.
  await page.locator('label', { hasText: w.role.developer.label }).click();
  await expect(page.getByRole('radio', { name: new RegExp(w.role.developer.label) })).toBeChecked();
  await expect(page.getByText(w.progress(1, 3))).toBeVisible();
  await expect
    .poll(async () => ((await harness.storage())['settings'] as { preset?: string } | undefined)?.preset)
    .toBe('developer');

  // Keyboard: the preset radios are reachable and switch with the arrow keys.
  await page.getByRole('radio', { name: new RegExp(w.role.developer.label) }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('radio', { name: new RegExp(w.role.reviewer.label) })).toBeChecked();
});

test('screenshots: welcome tab at four widths, light and dark', async ({ context }) => {
  const page = await welcomePage(context);
  for (const scheme of SCHEMES) {
    await page.emulateMedia({ colorScheme: scheme });
    await settle(page);
    for (const width of WELCOME_WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(0);
      await page.screenshot({ path: `${DIR}/welcome-${width}-${scheme}.png`, fullPage: true });
    }
  }
});

test('panel checklist ticks pick, note and export, then goes away', async ({ harness }) => {
  const { page, tabId } = await harness.openFixture('static.html');
  const panel = await harness.openPanel(tabId, 360);
  const card = panel.getByRole('region', { name: c.title });
  await expect(card.getByText(c.progressLabel(0, 3))).toBeAttached();

  await pickElement(panel, page, '[data-testid="hero-cta"]');
  await expect(overlay(page).getByRole('note')).toContainText(copy.tooltip.hint.body);
  await commentAndSave(page, 'Make the CTA calmer');
  await panel.bringToFront();
  await expect(rows(panel)).toHaveCount(1);
  await expect(card.getByText(c.progressLabel(2, 3))).toBeAttached();

  for (const scheme of SCHEMES) {
    await panel.emulateMedia({ colorScheme: scheme });
    await settle(panel);
    await panel.screenshot({ path: `${DIR}/panel-checklist-${scheme}.png` });
  }

  // The hint is a first-note thing only.
  await pickElement(panel, page, '[data-testid="promo-banner"]');
  await expect(commentBox(page)).toBeVisible();
  await expect(overlay(page).getByRole('note')).toHaveCount(0);
  await commentAndSave(page, 'Banner copy is too loud');

  await panel.bringToFront();
  await panel.getByRole('button', { name: copy.panel.footer.copyMarkdown }).click();
  await expect(card).toHaveCount(0);
});

test('closing the checklist keeps it closed', async ({ harness }) => {
  const { tabId } = await harness.openFixture('static.html');
  const panel = await harness.openPanel(tabId, 360);
  await panel.getByRole('button', { name: c.dismiss }).click();
  await expect(panel.getByRole('region', { name: c.title })).toHaveCount(0);
  await panel.reload();
  await expect(panel.getByRole('button', { name: copy.panel.states.firstRun.cta })).toBeVisible();
  await expect(panel.getByRole('region', { name: c.title })).toHaveCount(0);
});
