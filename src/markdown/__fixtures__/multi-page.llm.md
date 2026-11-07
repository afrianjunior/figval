# Figval Review — example.com

> Figval · session `fv-7k2q` · 2026-11-07 14:32 · 3 changes · 2 pages

## Instructions

You are maintaining this website's codebase. Each `FV-n` below is one task node.

**Locate** — try in order; move to the next only if the previous fails:
visible text → `data-testid` / `id` / `aria-label` → class names → DOM path → selector.
DOM paths come from the rendered page and may not match source structure.

**Apply**
- Style values are computed (px, hex). Map to existing tokens, CSS variables, or utility classes when an equivalent exists.
- Apply style changes to the component's variant definitions so hover, focus, active and disabled stay coherent. No one-off inline overrides.
- `scope: this element` → change only this instance. `scope: all similar` → change the shared component.
- `intent: propose` → do not implement; reply with a proposed change.

**When it breaks**
- String not found in code (likely i18n/CMS) or no matching token → `skipped`, give the reason. Do not hardcode.
- Element cannot be located, or two tasks conflict → `needs-clarification`. Do not guess.

**Boundaries**
- Change nothing beyond the listed tasks. Respect the execution order below.

---

## Page: `/about` — About · viewport 1440×900
URL: https://example.com/about/

### FV-1 · Team intro
`text` · scope: **this element** · intent: **apply** · state: rest

**Locate**
- Text: "Meet the team"
- Selector: `main > p`

**Change**
- Text: `Meet the team` → `Who we are`

**Verify:** On `/about`, the element reads "Who we are".

### FV-3 · Team photo
`hide` · scope: **this element** · intent: **apply** · state: rest

**Locate**
- Selector: `main img`

**Change**
- Remove this element.

**Verify:** On `/about`, the element is removed.

---

## Page: `/contact` — Contact · viewport 390×844
URL: https://example.com/contact

### FV-2 · Email link
`comment` · scope: **this element** · intent: **propose** · state: rest

**Comment:** Should this be a form instead?

**Locate**
- Text: "hello@example.com"
- Selector: `footer a`

**Verify:** Reply with a proposed change for this element; do not edit code.

---

## Return format

When done, reply with exactly this structure:

```
## Figval Report — session fv-7k2q

| ID | Status | Files | Note |
|----|--------|-------|------|
| FV-1 | done | src/components/Button.tsx | mapped to variant="primary" |

### Located components
FV-1:
  HomePage
    → HeroSection
      → Button (variant=primary)
```

Status: `done` · `skipped` · `needs-clarification` · `proposed`
