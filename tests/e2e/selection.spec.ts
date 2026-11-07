import { test, expect, copy } from './fixtures';
import { commentAndSave, copyLlm, overlay, pickButton, rows } from './helpers';

test('text selection note exports the selected text', async ({ harness }) => {
  const { page, tabId } = await harness.openFixture('static.html');
  const panel = await harness.openPanel(tabId);
  await pickButton(panel).first().click();
  await page.bringToFront();
  await page.locator('p.plan-desc').first().hover();
  await expect(overlay(page).getByText(copy.picker.hint.cancel)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(overlay(page).getByText(copy.picker.hint.cancel)).toBeHidden();
  await page.locator('p.plan-desc').first().selectText();
  const addNote = overlay(page).getByRole('button', { name: copy.picker.addNote });
  await expect(addNote).toBeVisible();
  await addNote.click();
  await commentAndSave(page, 'Tighten this sentence');
  await panel.bringToFront();
  await expect(rows(panel)).toHaveCount(1);
  expect(await copyLlm(panel, harness.readClipboard)).toContain('Selected text:');
});
