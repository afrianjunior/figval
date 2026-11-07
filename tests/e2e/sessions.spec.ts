import { test, expect, copy } from './fixtures';
import { commentAndSave, pickElement, rows } from './helpers';

test('multi-session switch lists each session notes', async ({ harness }) => {
  const { page, tabId } = await harness.openFixture('static.html');
  const panel = await harness.openPanel(tabId);
  await pickElement(panel, page, '[data-testid="hero-cta"]');
  await commentAndSave(page, 'First session note');
  await panel.bringToFront();
  await expect(rows(panel)).toHaveCount(1);

  await panel.getByTitle(copy.panel.header.sessionSwitcherLabel).click();
  await panel.getByRole('button', { name: copy.panel.sessions.newSession }).click();
  await expect(panel.getByRole('heading', { name: copy.panel.sessions.title })).toHaveCount(0);

  await pickElement(panel, page, '[data-testid="promo-banner"]');
  await commentAndSave(page, 'Second session note');
  await panel.bringToFront();
  await expect(rows(panel)).toHaveCount(1);
  await expect(rows(panel).first()).toContainText('Second session note');

  await panel.getByTitle(copy.panel.header.sessionSwitcherLabel).click();
  const sessionButtons = panel.locator('.fvp-session__main');
  await expect(sessionButtons).toHaveCount(2);
  await panel.locator('.fvp-session__main:not([aria-current])').click();
  await expect(rows(panel)).toHaveCount(1);
  await expect(rows(panel).first()).toContainText('First session note');
});
