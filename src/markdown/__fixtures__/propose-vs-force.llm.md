# Figval Review — example.com

> Figval · session `fv-7k2q` · 2026-11-07 14:32 · 3 changes · 1 page

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

## Page: `/` — Home · viewport 1440×900
URL: https://example.com/

### FV-1 · Pricing link
`comment` · scope: **this element** · intent: **propose** · state: rest

**Why:** Not obvious that this opens a new page

**Comment:** Maybe add an icon?

**Locate**
- Text: "Pricing"
- Selector: `nav a:nth-of-type(2)`

**Verify:** Reply with a proposed change for this element; do not edit code.

### FV-2 · Footer note
`comment` · scope: **this element** · intent: **apply** · state: rest

**Comment:** Drop the year range

**Locate**
- Text: "All rights reserved"
- Selector: `footer small`

**Verify:** On `/`, the element matches the request above.

### FV-3 · Nav logo
scope: **this element** · intent: **apply** · state: rest

**Locate**
- Selector: `nav img`

**Verify:** On `/`, the element matches the request above.

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
