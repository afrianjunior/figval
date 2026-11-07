# Figval Review — example.com

> Figval · session `fv-7k2q` · 2026-11-07 14:32 · 4 changes · 2 pages

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
wave1[FV-1 ∥ FV-2 ∥ FV-3] → wave2[FV-4]
```
FV-4 depends on FV-1: both touch `a.btn-primary`; FV-4 overrides FV-1 for one instance.

---

## Page: `/` — Home · viewport 1440×900
URL: https://example.com/

### FV-1 · Hero CTA button
`text` `style` · scope: **all similar** (4 found) · intent: **apply** · state: rest

**Why:** Too loud, match the button style on /pricing

**Locate**
- Text: "Daftar Sekarang Juga!!"
- Attributes: `data-testid="hero-cta"`
- DOM path:
  ```
  main
    → section.hero
      → div.hero__inner
        → a.btn-primary
  ```
- Selector: `section.hero > div > a.btn-primary`

**Change**
- Text: `Daftar Sekarang Juga!!` → `Mulai gratis`

| Property | Before | After |
|---|---|---|
| background-color | `#FF2D55` | `#0F62FE` |
| font-size | `20px` | `16px` |
| padding-block | `20px` | `12px` |
| padding-inline | `48px` | `24px` |
| border-radius | `0px` | `8px` |

**Verify:** On `/`, the element reads "Mulai gratis" with background-color `#0F62FE`, font-size `16px`, padding-block `12px`, padding-inline `24px`, border-radius `8px`; all 4 matching elements updated; hover/focus states still distinct.

**HTML**
```html
<a class="btn-primary hero__cta" data-testid="hero-cta" href="/signup">Daftar Sekarang Juga!!</a>
```

### FV-2 · Hero headline
`comment` · scope: **this element** · intent: **propose** · state: rest

**Comment:** Is this claim backed by anything we can show?

**Locate**
- Text: "Ship faster"
- DOM path:
  ```
  main
    → section.hero
      → h1
  ```
- Selector: `section.hero h1`

**Verify:** Reply with a proposed change for this element; do not edit code.

**HTML**
```html
<h1>Ship faster</h1>
```

### FV-4 · Footer signup link
`style` `comment` · scope: **this element** · intent: **apply** · state: rest

**Why:** Keep the muted tone here

**Locate**
- Text: "Daftar"
- Selector: `footer a.btn-primary`

**Change**
| Property | Before | After |
|---|---|---|
| background-color | `#FF2D55` | `#6B7280` |

**Verify:** On `/`, the element with background-color `#6B7280`; hover/focus states still distinct.

**HTML**
```html
<a class="btn-primary footer__cta" href="/signup">Daftar</a>
```

---

## Page: `/pricing` — Pricing · viewport 1280×720
URL: https://example.com/pricing?ref=nav#plans

### FV-3 · Plan heading
`text` · scope: **this element** · intent: **apply** · state: rest

**Locate**
- Text: "Choose a plan"
- Selector: `main h2`

**Change**
- Text: `Choose a plan` → `Pick a plan`

**Verify:** On `/pricing`, the element reads "Pick a plan".

**HTML**
```html
<h2>Choose a plan</h2>
```

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
