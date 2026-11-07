import { describe, expect, it } from 'vitest';
import { makeNote, NOW } from './__fixtures__/builders';
import { exportFilename, exportTitle, TITLE_MAX } from './title';

const at = (seq: number, url: string) => makeNote({ seq, url });

describe('exportTitle', () => {
  it('uses host and path for one page', () => {
    expect(exportTitle([at(1, 'https://www.example.com/register?x=1#y')], 'llm')).toBe(
      'Figval Review — example.com/register',
    );
  });

  it('uses the bare host when the single page is the root', () => {
    expect(exportTitle([at(1, 'https://example.com/')], 'llm')).toBe('Figval Review — example.com');
  });

  it('uses the host for many pages on one host', () => {
    expect(
      exportTitle([at(1, 'https://example.com/a'), at(2, 'https://www.example.com/b')], 'llm'),
    ).toBe('Figval Review — example.com');
  });

  it('counts sites when hosts differ, keeping the port as part of the host', () => {
    const notes = [
      at(1, 'https://example.com/a'),
      at(2, 'http://example.com:3000/a'),
      at(3, 'https://other.dev/'),
    ];
    expect(exportTitle(notes, 'llm')).toBe('Figval Review — 3 sites');
  });

  it('collapses long paths to first and last segment with an ellipsis', () => {
    const title = exportTitle(
      [at(1, 'https://example.com/docs/getting-started/install/linux/ubuntu')],
      'llm',
    );
    expect(title).toBe('Figval Review — example.com/docs/…/ubuntu');
  });

  it('hard clips a long subject that cannot be collapsed further', () => {
    const long = `https://example.com/${'a'.repeat(80)}`;
    const subject = exportTitle([at(1, long)], 'llm').replace('Figval Review — ', '');
    expect(subject).toHaveLength(TITLE_MAX);
    expect(subject.endsWith('…')).toBe(true);
  });

  it('keeps a long two-segment subject within the limit', () => {
    const subject = exportTitle(
      [at(1, `https://example.com/${'b'.repeat(30)}/${'c'.repeat(30)}`)],
      'llm',
    );
    expect(subject.replace('Figval Review — ', '').length).toBeLessThanOrEqual(TITLE_MAX);
  });

  it('uses the copy title for human output', () => {
    expect(
      exportTitle([at(1, 'https://example.com/a'), at(2, 'https://example.com/b')], 'human'),
    ).toBe('Website review: example.com');
  });

  it('handles an empty export in both formats', () => {
    expect(exportTitle([], 'llm')).toBe('Figval Review');
    expect(exportTitle([], 'human')).toBe('Website review:');
  });
});

describe('exportFilename', () => {
  it('slugs host and path for one page', () => {
    expect(exportFilename([at(1, 'https://www.example.com/register/?q=1#x')], NOW)).toBe(
      'figval-example.com-register-2026-11-07.md',
    );
  });

  it('turns every slash in a nested path into a dash', () => {
    expect(exportFilename([at(1, 'https://example.com/a/b/c')], NOW)).toBe(
      'figval-example.com-a-b-c-2026-11-07.md',
    );
  });

  it('uses the host for the root path and for many pages on one host', () => {
    expect(exportFilename([at(1, 'https://example.com/')], NOW)).toBe(
      'figval-example.com-2026-11-07.md',
    );
    expect(
      exportFilename([at(1, 'https://example.com/a'), at(2, 'https://example.com/b')], NOW),
    ).toBe('figval-example.com-2026-11-07.md');
  });

  it('uses "N-sites" across hosts', () => {
    expect(exportFilename([at(1, 'https://a.com/'), at(2, 'https://b.com/')], NOW)).toBe(
      'figval-2-sites-2026-11-07.md',
    );
  });

  it('replaces unsafe characters such as the port colon', () => {
    expect(exportFilename([at(1, 'http://localhost:3000/')], NOW)).toBe(
      'figval-localhost-3000-2026-11-07.md',
    );
  });

  it('drops the slug for an empty export and reads the date in UTC', () => {
    expect(exportFilename([], Date.UTC(2026, 0, 2, 23, 59))).toBe('figval-2026-01-02.md');
  });
});
