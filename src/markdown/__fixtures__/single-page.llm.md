# Figval Review — example.com/register

> Figval · session `fv-7k2q` · 2026-11-07 14:32 · 1 change · 1 page

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

## Page: `/register` — Register · viewport 1024×768
URL: https://www.example.com/register/?plan=pro#top

### FV-1 · Register heading
`text` `style` · scope: **this element** · intent: **apply** · state: rest

**Why:** Sounds like a bank form

**Locate**
- Text: "Create your account"
- Attributes: `id="register-title"`, `aria-label="Registration"`
- DOM path:
  ```
  main
    → form#register
      → h1.title:nth-of-type(1)
  ```
- Selector: `#register-title`

**Change**
- Text: `Create your account` → `Join in a minute`

| Property | Before | After |
|---|---|---|
| font-weight | `400` | `700` |

**Verify:** On `/register`, the element reads "Join in a minute" with font-weight `700`; hover/focus states still distinct.

**HTML**
```html
<h1 id="register-title" class="title">Create your account</h1>
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
