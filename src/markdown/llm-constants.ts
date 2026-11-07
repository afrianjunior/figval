// Agent-facing contract from p.impl.md section 11.2. Reproduced verbatim, em dashes included. Do not rephrase.

export const INSTRUCTIONS_LINES: readonly string[] = [
  '## Instructions',
  '',
  "You are maintaining this website's codebase. Each `FV-n` below is one task node.",
  '',
  '**Locate** — try in order; move to the next only if the previous fails:',
  'visible text → `data-testid` / `id` / `aria-label` → class names → DOM path → selector.',
  'DOM paths come from the rendered page and may not match source structure.',
  '',
  '**Apply**',
  '- Style values are computed (px, hex). Map to existing tokens, CSS variables, or utility classes when an equivalent exists.',
  "- Apply style changes to the component's variant definitions so hover, focus, active and disabled stay coherent. No one-off inline overrides.",
  '- `scope: this element` → change only this instance. `scope: all similar` → change the shared component.',
  '- `intent: propose` → do not implement; reply with a proposed change.',
  '',
  '**When it breaks**',
  '- String not found in code (likely i18n/CMS) or no matching token → `skipped`, give the reason. Do not hardcode.',
  '- Element cannot be located, or two tasks conflict → `needs-clarification`. Do not guess.',
  '',
  '**Boundaries**',
  '- Change nothing beyond the listed tasks. Respect the execution order below.',
];

/** Session id baked into the template example; swapped for the real id at render time. */
export const TEMPLATE_SESSION_ID = 'fv-7k2q';

export const RETURN_FORMAT_LINES: readonly string[] = [
  '## Return format',
  '',
  'When done, reply with exactly this structure:',
  '',
  '```',
  '## Figval Report — session fv-7k2q',
  '',
  '| ID | Status | Files | Note |',
  '|----|--------|-------|------|',
  '| FV-1 | done | src/components/Button.tsx | mapped to variant="primary" |',
  '',
  '### Located components',
  'FV-1:',
  '  HomePage',
  '    → HeroSection',
  '      → Button (variant=primary)',
  '```',
  '',
  'Status: `done` · `skipped` · `needs-clarification` · `proposed`',
];
