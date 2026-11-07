import { describe, expect, it } from 'vitest';
import { copy, ERROR_TAGS } from './strings';

const collectStrings = (value: unknown, out: string[] = []): string[] => {
  if (typeof value === 'string') out.push(value);
  else if (typeof value === 'function') {
    const result: unknown = (value as (...a: unknown[]) => unknown)(
      ...Array.from({ length: value.length }, (_, i) => (i === 0 ? 2 : 'x')),
    );
    if (typeof result === 'string') out.push(result);
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((v) => collectStrings(v, out));
  }
  return out;
};

describe('copy', () => {
  it('has a non-empty user-facing line for every error tag', () => {
    for (const tag of ERROR_TAGS) {
      expect(copy.errors[tag].length).toBeGreaterThan(0);
    }
  });

  it('contains no error tag keys beyond the known list', () => {
    expect(Object.keys(copy.errors).sort()).toEqual([...ERROR_TAGS].sort());
  });

  it('never uses em or en dashes outside the spec-fixed title', () => {
    const all = collectStrings(copy).filter((s) => /[–—]/.test(s));
    expect(all).toEqual([]);
  });

  it('keeps keyboard hints as data', () => {
    expect(copy.keys.submit).toBe('⌘↵');
    expect(copy.keys.escape).toBe('Esc');
  });

  it('pluralizes counts', () => {
    expect(copy.panel.states.notActivated.strip(1)).toContain('1 note ');
    expect(copy.panel.states.notActivated.strip(3)).toContain('3 notes ');
    expect(copy.markdownHuman.summary.textChange(1)).toBe('1 text change');
    expect(copy.markdownHuman.summary.textChange(2)).toBe('2 text changes');
  });

  it('labels the single-page url for the human export meta line', () => {
    expect(copy.markdownHuman.pageUrl('https://example.com/pricing')).toBe(
      '**Page:** https://example.com/pricing',
    );
  });

  it('interpolates the search query in the empty results line', () => {
    expect(copy.panel.states.noResults.line('xyz')).toBe('No notes match "xyz".');
  });

  it('words the filter-only miss and the target state meta line', () => {
    expect(copy.panel.states.noResults.filterLine).toBe('No notes match these filters.');
    expect(copy.panel.detail.meta('/register', 1440, 900, 'rest')).toBe(
      '/register · 1440×900 · rest',
    );
    expect(copy.panel.detail.meta('/register', 1440, 900, 'hover')).toBe(
      '/register · 1440×900 · hover',
    );
  });

  it('exposes labels the side panel and tooltip need', () => {
    expect(copy.panel.states.loading).toBe('Loading notes');
    expect(copy.panel.detail.locatorParts.domPath).toBe('DOM path');
    expect(Object.keys(copy.panel.detail.changeGroups)).toEqual([
      'text',
      'fill',
      'typography',
      'layout',
      'visibility',
    ]);
    expect(copy.toasts.dismiss).toBe('Dismiss');
    expect(copy.tooltip.edit.colorRow.openPicker).toBe('Open color picker');
  });

  it('names font weights and falls back to the bare number', () => {
    expect(copy.tooltip.edit.fontWeightOption(400)).toBe('400 Regular');
    expect(copy.tooltip.edit.fontWeightOption(600)).toBe('600 Semibold');
    expect(copy.tooltip.edit.fontWeightOption(450)).toBe('450');
  });

  it('adds the new error tags with a next step', () => {
    for (const tag of [
      'NoteNotFound',
      'SessionNotFound',
      'InvalidOrder',
      'DownloadFailed',
    ] as const) {
      expect(ERROR_TAGS).toContain(tag);
      expect(copy.errors[tag].length).toBeGreaterThan(0);
    }
    expect(copy.errors.DownloadFailed).toContain('Copy markdown');
    expect(copy.panel.footer.copyMarkdown).toBe('Copy markdown');
  });

  it('uses one wording for shared failure lines', () => {
    const saveFailed = "The note wasn't saved. Your changes are still here, so try again.";
    expect(copy.errors.NoteSaveError).toBe(saveFailed);
    expect(copy.tooltip.status.saveFailed).toBe(saveFailed);
    expect(copy.panel.states.storageError.line).toBe(saveFailed);
    const declined =
      "Site access was declined, so Figval can't pick elements here. Choose Try again to allow it.";
    expect(copy.panel.toolbar.retry).toBe('Try again');
    expect(copy.errors.PermissionDenied).toBe(declined);
    expect(copy.panel.toolbar.helper.permissionDeclined).toBe(declined);
    expect(copy.panel.toolbar.helper.injectionFailed).toBe(
      "Figval couldn't start on this page. Reload the page and try again.",
    );
    expect(copy.errors.ShotStoreError).toBe(
      "The screenshot couldn't be saved or loaded. The note is still saved.",
    );
    const gone = "Figval can't find this element on the page anymore. The page may have changed.";
    expect(copy.errors.ElementNotFound).toBe(`${gone} The note is still saved.`);
    const both = `${gone} The note and its screenshot are still saved.`;
    expect(copy.panel.states.notFound.explanation).toBe(both);
    expect(copy.panel.detail.notFoundExplanation).toBe(both);
    expect(copy.panel.settings.corrupt(2)).toContain("couldn't be read");
  });

  it('words the session delete confirmation for 0, 1 and many notes', () => {
    const body = copy.panel.sessions.deleteDialog.body;
    expect(body(0)).toBe("This deletes the session. This can't be undone.");
    expect(body(1)).toBe(
      "This deletes the note and every screenshot in this session. This can't be undone.",
    );
    expect(body(4)).toBe(
      "This deletes all 4 notes and every screenshot in this session. This can't be undone.",
    );
  });

  it('exposes the new labels and toast wording', () => {
    expect(copy.keys.toggleShortcut).toBe('⌥⇧F');
    expect(copy.keys.toggleShortcutOther).toBe('Alt+Shift+F');
    expect(copy.tooltip.edit.controls.paddingVertical).toBe('Vertical padding');
    expect(copy.tooltip.edit.controls.paddingHorizontal).toBe('Horizontal padding');
    expect(copy.tooltip.edit.controls.radius).toBe('Corner radius');
    expect(copy.tooltip.edit.controls.textAlign).toBe('Text alignment');
    expect(copy.toasts.deleted).toBe('Note deleted');
    expect(copy.toasts.downloaded).toBe('Markdown downloaded');
    expect(copy.tooltip.comment.placeholder).toBe('What should change?');
    expect(copy.panel.detail.copyBefore).toBe('Copy before screenshot');
    expect(copy.panel.detail.copyAfter).toBe('Copy after screenshot');
    expect(copy.panel.detail.changeTo).toBe('to');
  });
});
