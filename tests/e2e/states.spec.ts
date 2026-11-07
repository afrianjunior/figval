import { test, expect, copy, queryTabs } from './fixtures';
import { commentAndSave, pickElement, rows } from './helpers';

test('unsupported page shows the message while the panel still renders', async ({
  context,
  harness,
}) => {
  const page = await context.newPage();
  await page.goto('about:blank');
  const tabId = await queryTabs(harness.serviceWorker, 'about:blank');
  const panel = await harness.openPanel(tabId);
  await expect(panel.getByText(copy.panel.states.unsupported.line)).toBeVisible();
  await expect(panel.getByRole('button', { name: copy.panel.footer.copyMarkdown })).toBeVisible();
});

test('delete shows Undo toast, undo restores, second delete persists after timeout', async ({
  harness,
}) => {
  const { page, tabId } = await harness.openFixture('static.html');
  const panel = await harness.openPanel(tabId);
  await pickElement(panel, page, '[data-testid="hero-cta"]');
  await commentAndSave(page, 'Delete me');
  await panel.bringToFront();
  await expect(rows(panel)).toHaveCount(1);

  const remove = async (): Promise<void> => {
    await rows(panel).first().locator('.fv-layer__main').focus();
    await panel.keyboard.press('Delete');
  };
  await remove();
  await expect(panel.getByText(copy.toasts.deleted)).toBeVisible();
  await panel.getByRole('button', { name: copy.toasts.undo }).click();
  await expect(rows(panel)).toHaveCount(1);

  await remove();
  await expect(panel.getByText(copy.toasts.deleted)).toBeVisible();
  await expect(panel.getByText(copy.toasts.deleted)).toHaveCount(0, { timeout: 12_000 });
  await expect(rows(panel)).toHaveCount(0);
  await expect
    .poll(async () => JSON.stringify(await harness.storage()).includes('Delete me'))
    .toBe(false);
});
