# Figval Review — example.com

> Figval · session `fv-7k2q` · 2026-11-07 14:32 · 2 changes · 1 page

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

### FV-1 · Cookie banner
`hide` · scope: **this element** · intent: **apply** · state: rest

**Why:** Covers the signup button on mobile

**Locate**
- Attributes: `role="dialog"`, `name="cookies"`
- Selector: `div.cookie-banner`

**Change**
- Remove this element.

**Verify:** On `/`, the element is removed.

**HTML**
```html
<div class="cookie-banner" role="dialog">We use cookies</div>
```

### FV-2 · Promo strip
`style` `hide` `comment` · scope: **this element** · intent: **apply** · state: rest

**Why:** Remove, then fix the spacing

**Locate**
- Text: "Free shipping"
- Selector: `div.promo`

**Change**
- Remove this element.

| Property | Before | After |
|---|---|---|
| padding-block | `12px` | `0px` |

**Verify:** On `/`, the element is removed.

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
