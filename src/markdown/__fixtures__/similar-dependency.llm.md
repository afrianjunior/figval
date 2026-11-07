# Figval Review — example.com

> Figval · session `fv-7k2q` · 2026-11-07 14:32 · 4 changes · 1 page

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

## Execution graph

```
wave1[FV-1 ∥ FV-4] → wave2[FV-2 ∥ FV-3]
```
FV-2 depends on FV-1: both edit the same element; FV-2 overrides FV-1 for one instance.
FV-3 depends on FV-1: both touch `button.cta`; FV-3 overrides FV-1 for one instance.

---

## Page: `/` — Home · viewport 1440×900
URL: https://example.com/

### FV-1 · Primary button
`style` · scope: **all similar** (7 found) · intent: **apply** · state: rest

**Locate**
- Selector: `main button.cta`

**Change**
| Property | Before | After |
|---|---|---|
| border-radius | `0px` | `6px` |

**Verify:** On `/`, the element with border-radius `6px`; all 7 matching elements updated; hover/focus states still distinct.

### FV-2 · Primary button
`text` · scope: **this element** · intent: **apply** · state: rest

**Why:** Same button, needs a different label

**Locate**
- Selector: `main button.cta`

**Change**
- Text: `Send` → `Send message`

**Verify:** On `/`, the element reads "Send message".

### FV-3 · Sidebar button
`style` · scope: **this element** · intent: **apply** · state: rest

**Locate**
- Selector: `aside button.cta`

**Change**
| Property | Before | After |
|---|---|---|
| color | `#111111` | `#FFFFFF` |

**Verify:** On `/`, the element with color `#FFFFFF`; hover/focus states still distinct.

### FV-4 · Cancel link
`style` · scope: **this element** · intent: **apply** · state: rest

**Locate**
- Selector: `form a.link`

**Change**
| Property | Before | After |
|---|---|---|
| text-align | `left` | `center` |

**Verify:** On `/`, the element with text-align `center`; hover/focus states still distinct.

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
