import { expect, type Locator, type Page } from '@playwright/test';
import { copy } from '../../src/copy';

/** Locator scoped to Figval's overlay shadow root (open shadow roots are pierced by CSS locators). */
export const overlay = (page: Page): Locator => page.locator('figval-root');

export const pickButton = (panel: Page): Locator =>
  panel.getByRole('button', { name: copy.panel.toolbar.pick });

/** Starts the picker from the panel, then clicks `selector` on the page and waits for the tooltip. */
export const pickElement = async (panel: Page, page: Page, selector: string): Promise<void> => {
  await pickButton(panel).first().click();
  await page.bringToFront();
  const target = page.locator(selector).first();
  await target.hover();
  await expect(overlay(page).getByText(copy.picker.hint.cancel)).toBeVisible();
  await target.click();
  await expect(commentBox(page)).toBeVisible();
};

export const commentBox = (page: Page): Locator =>
  overlay(page).getByRole('textbox', { name: copy.tooltip.comment.placeholder });

export const saveButton = (page: Page): Locator =>
  overlay(page).getByRole('button', { name: copy.tooltip.actions.save });

/** Types a comment and saves; resolves when the tooltip has closed. */
export const commentAndSave = async (page: Page, text: string): Promise<void> => {
  await commentBox(page).fill(text);
  await saveButton(page).click();
  await expect(commentBox(page)).toHaveCount(0);
};

export const rows = (panel: Page): Locator => panel.locator('[data-note-id]');

export const copyLlm = async (panel: Page, read: (p: Page) => Promise<string>): Promise<string> => {
  await panel.bringToFront();
  await panel.getByRole('radio', { name: copy.panel.footer.format.llm }).click();
  await panel.getByRole('button', { name: copy.panel.footer.copyMarkdown }).click();
  await expect(panel.getByRole('button', { name: copy.panel.footer.copied })).toBeVisible();
  return read(panel);
};

export const computed = (page: Page, selector: string, prop: string): Promise<string> =>
  page
    .locator(selector)
    .first()
    .evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

export const editTab = (page: Page): Locator =>
  overlay(page).getByRole('tab', { name: copy.tooltip.tabs.edit });

const editLabels = copy.tooltip.edit;

/** Sets text, background and font size in the open tooltip's Edit tab. */
export const applyStyleEdit = async (
  page: Page,
  edit: { readonly text?: string; readonly background: string; readonly fontSize: number },
): Promise<void> => {
  await editTab(page).click();
  const o = overlay(page);
  if (edit.text !== undefined)
    await o.getByRole('textbox', { name: editLabels.sections.text }).fill(edit.text);
  const hex = o.getByRole('textbox', { name: editLabels.colorRow.hexField }).nth(1);
  await hex.fill(edit.background);
  await hex.press('Enter');
  const size = o.getByRole('spinbutton', { name: editLabels.controls.fontSize });
  await size.fill(String(edit.fontSize));
  await size.press('Enter');
};

export const chooseSimilar = async (page: Page): Promise<void> => {
  const option = overlay(page).getByRole('radio', { name: /^All similar/ });
  await expect(option).toBeEnabled();
  await option.click();
};

export const saveEdit = async (page: Page): Promise<void> => {
  await saveButton(page).click();
  await expect(commentBox(page)).toHaveCount(0);
};

export const setBeforeAfter = async (panel: Page, which: 'before' | 'after'): Promise<void> => {
  await panel.bringToFront();
  await panel.getByRole('radio', { name: copy.panel.toolbar[which] }).click();
};

/**
 * Waits for a colour-scheme change to finish rendering: two animation frames so transitions
 * start, every finite animation/transition (document and open shadow roots, e.g. `figval-root`)
 * to finish, then two more frames so the final style is painted.
 */
export const settle = async (page: Page): Promise<void> => {
  await page.evaluate(async () => {
    const frames = (): Promise<void> =>
      new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())));
    const roots = (): (Document | ShadowRoot)[] => {
      const found: (Document | ShadowRoot)[] = [document];
      for (const el of document.querySelectorAll('*')) {
        if (el.shadowRoot) found.push(el.shadowRoot);
      }
      return found;
    };
    const pending = (): Promise<Animation>[] =>
      roots()
        .flatMap((root) => root.getAnimations())
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished);
    await frames();
    await Promise.allSettled(pending());
    await frames();
  });
};
