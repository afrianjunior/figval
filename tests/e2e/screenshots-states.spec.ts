import { resolve } from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { test, expect, copy, queryTabs } from './fixtures';
import {
  applyStyleEdit,
  commentAndSave,
  overlay,
  pickButton,
  pickElement,
  rows,
  saveEdit,
  settle,
} from './helpers';

const DIR = resolve(import.meta.dirname, '__screenshots__');
const SCHEMES = ['light', 'dark'] as const;
type Scheme = (typeof SCHEMES)[number];

const edit = copy.tooltip.edit;
const CTA = '[data-testid="hero-cta"]';
const BANNER = '[data-testid="promo-banner"]';

const shoot = async (page: Page, name: string, scheme: Scheme): Promise<void> => {
  await page.screenshot({ path: `${DIR}/${name}-${scheme}.png` });
};

/** Waits until the element's computed opacity has finished transitioning to fully visible. */
const settled = (target: Locator): Promise<void> =>
  expect
    .poll(() => target.evaluate((el) => getComputedStyle(el).opacity), { timeout: 5_000 })
    .toBe('1');

const tipReady = (page: Page): Promise<void> => settled(overlay(page).locator('.fv-tip').first());

test('screenshots: tooltip Edit tab with changed rows, and with the color popover', async ({
  harness,
}) => {
  const { page, tabId } = await harness.openFixture('static.html');
  const panel = await harness.openPanel(tabId);
  await pickElement(panel, page, CTA);
  await applyStyleEdit(page, { text: 'Start free', background: '#ff0000', fontSize: 22 });
  const o = overlay(page);
  await expect(o.getByRole('button', { name: edit.resetAll })).toBeVisible();
  await expect(o.getByText(edit.changedDot).first()).toBeAttached();

  for (const scheme of SCHEMES) {
    await page.emulateMedia({ colorScheme: scheme });
    await settle(page);
    await tipReady(page);
    await shoot(page, 'tooltip-edit', scheme);
  }

  await o.getByRole('button', { name: edit.colorRow.openPicker }).nth(1).click();
  const pop = o.getByRole('group', { name: edit.colorRow.picker });
  await expect(pop).toBeVisible();
  for (const scheme of SCHEMES) {
    await page.emulateMedia({ colorScheme: scheme });
    await settle(page);
    await expect(pop).toBeVisible();
    await shoot(page, 'tooltip-color', scheme);
  }
});

/** Opens FV-1's Detail view in the panel and checks the given change sections are listed. */
const openDetail = async (panel: Page, groups: readonly string[]): Promise<void> => {
  await panel.bringToFront();
  await expect(rows(panel)).toHaveCount(1);
  await rows(panel).first().locator('.fv-layer__main').click();
  await expect(panel.getByRole('heading', { name: /^FV-1 · / })).toBeVisible();
  for (const group of groups) {
    await expect(panel.getByRole('heading', { name: group, exact: true })).toBeVisible();
  }
  await panel.setViewportSize({ width: 420, height: 1400 });
};

const groupsOf = copy.panel.detail.changeGroups;

test('screenshots: panel Detail drill-in with text, fill, typography and layout changes', async ({
  harness,
}) => {
  const { page, tabId } = await harness.openFixture('static.html');
  const panel = await harness.openPanel(tabId);
  await pickElement(panel, page, CTA);
  await applyStyleEdit(page, { text: 'Start free', background: '#ff0000', fontSize: 22 });
  const padding = overlay(page).getByRole('spinbutton', { name: edit.controls.paddingVertical });
  await padding.fill('20');
  await padding.press('Enter');
  await saveEdit(page);
  await openDetail(panel, [groupsOf.text, groupsOf.fill, groupsOf.typography, groupsOf.layout]);
  for (const scheme of SCHEMES) {
    await panel.emulateMedia({ colorScheme: scheme });
    await settle(panel);
    await shoot(panel, 'panel-detail', scheme);
  }
});

// Hiding an element drops its style edits by design (src/content/edit/diff.ts:33), so the
// Visibility section cannot share a note with Fill/Typography/Layout; it gets its own capture.
test('screenshots: panel Detail drill-in with a hidden element', async ({ harness }) => {
  const { page, tabId } = await harness.openFixture('static.html');
  const panel = await harness.openPanel(tabId);
  await pickElement(panel, page, CTA);
  await applyStyleEdit(page, { text: 'Start free', background: '#ff0000', fontSize: 22 });
  await overlay(page).getByRole('checkbox', { name: edit.controls.hide }).check();
  await saveEdit(page);
  await openDetail(panel, [groupsOf.text, groupsOf.visibility]);
  for (const scheme of SCHEMES) {
    await panel.emulateMedia({ colorScheme: scheme });
    await settle(panel);
    await shoot(panel, 'panel-detail-hidden', scheme);
  }
});

test('screenshots: picker outline with label chip while hovering an element', async ({
  harness,
}) => {
  const { page, tabId } = await harness.openFixture('static.html');
  const panel = await harness.openPanel(tabId);
  await pickButton(panel).first().click();
  await page.bringToFront();
  await page.locator(CTA).hover();
  await expect(overlay(page).getByText(copy.picker.hint.cancel)).toBeVisible();
  const chip = overlay(page).locator('.fv-ov-chip:not(:empty)').first();
  await expect(chip).toContainText('×');
  for (const scheme of SCHEMES) {
    await page.emulateMedia({ colorScheme: scheme });
    await settle(page);
    await expect(chip).toBeVisible();
    await shoot(page, 'picker', scheme);
  }
});

test('screenshots: pin hover preview, including a pin at the right edge', async ({ harness }) => {
  const { page, tabId } = await harness.openFixture('static.html');
  const panel = await harness.openPanel(tabId);
  await pickElement(panel, page, CTA);
  await commentAndSave(page, 'Make the CTA calmer');
  await pickElement(panel, page, BANNER);
  await commentAndSave(page, 'Banner copy is too loud for a first-time visitor');
  await page.bringToFront();
  const bannerPin = overlay(page).getByRole('button', { name: 'FV-2' });
  await expect(bannerPin).toBeVisible();
  await bannerPin.hover();
  const preview = overlay(page).getByRole('tooltip').filter({ hasText: 'Banner copy' });
  for (const scheme of SCHEMES) {
    await page.emulateMedia({ colorScheme: scheme });
    await settle(page);
    await settled(preview);
    await shoot(page, 'pin-hover', scheme);
  }
});

test('screenshots: panel with search bar and an active filter chip', async ({ harness }) => {
  const { page, tabId } = await harness.openFixture('static.html');
  const panel = await harness.openPanel(tabId);
  const targets = [
    CTA,
    BANNER,
    '[data-testid="plan-free"] p.plan-desc',
    '[data-testid="plan-pro"] p.plan-desc',
    '[data-testid="nav-signup"]',
  ];
  for (const [i, selector] of targets.entries()) {
    await pickElement(panel, page, selector);
    await commentAndSave(page, `Note number ${i + 1}`);
  }
  await panel.bringToFront();
  await expect(rows(panel)).toHaveCount(targets.length);
  const search = panel.getByRole('search');
  await expect(search).toBeVisible();
  const chip = search.getByRole('button', {
    name: copy.panel.search.chips.comment,
    exact: true,
  });
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  for (const scheme of SCHEMES) {
    await panel.emulateMedia({ colorScheme: scheme });
    await settle(panel);
    await expect(rows(panel)).toHaveCount(targets.length);
    await shoot(panel, 'panel-search', scheme);
  }
});

test('screenshots: panel first-run state', async ({ harness }) => {
  const { tabId } = await harness.openFixture('static.html');
  const panel = await harness.openPanel(tabId);
  await expect(panel.getByText(copy.panel.states.firstRun.line)).toBeVisible();
  for (const scheme of SCHEMES) {
    await panel.emulateMedia({ colorScheme: scheme });
    await settle(panel);
    await shoot(panel, 'panel-firstrun', scheme);
  }
});

test('screenshots: panel unsupported-page state', async ({ context, harness }) => {
  const page = await context.newPage();
  await page.goto('about:blank');
  const tabId = await queryTabs(harness.serviceWorker, 'about:blank');
  const panel = await harness.openPanel(tabId);
  await expect(panel.getByText(copy.panel.states.unsupported.line)).toBeVisible();
  for (const scheme of SCHEMES) {
    await panel.emulateMedia({ colorScheme: scheme });
    await settle(panel);
    await shoot(panel, 'panel-unsupported', scheme);
  }
});
