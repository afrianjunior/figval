import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FIXTURE_DIR = resolve(__dirname, '../../tests/fixtures');

/** Test helper: parse a W0 fixture into a fresh happy-dom document. */
export function loadFixture(name: string): Document {
  const html = readFileSync(resolve(FIXTURE_DIR, name), 'utf8');
  return new DOMParser().parseFromString(html, 'text/html');
}
