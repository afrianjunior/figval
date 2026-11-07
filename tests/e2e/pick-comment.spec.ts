import { test, expect } from './fixtures';
import { commentAndSave, copyLlm, pickElement, rows } from './helpers';

test('pick, comment, save, row appears, copy LLM markdown', async ({ harness }) => {
  const { page, tabId } = await harness.openFixture('static.html');
  const panel = await harness.openPanel(tabId);
  await pickElement(panel, page, '[data-testid="hero-cta"]');
  await commentAndSave(page, 'Make the CTA calmer');
  await panel.bringToFront();
  await expect(rows(panel)).toHaveCount(1);
  await expect(rows(panel).first()).toContainText('Make the CTA calmer');
  const md = await copyLlm(panel, harness.readClipboard);
  expect(md.startsWith('# Figval Review — ')).toBe(true);
  for (const part of ['### FV-1 · ', '**Locate**', '**HTML**', '## Return format']) {
    expect(md).toContain(part);
  }
  expect(md).toContain('hero-cta');
});
