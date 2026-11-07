# Website review: example.com

**Date:** 7 November 2026 · **Notes:** 4 · **Pages:** 2
**Screen size during review:** 1440×900

## Summary
- 2 text changes
- 2 style changes
- 2 comments

---

## Home (`/`)

### 1. Hero CTA button
**Note:** Too loud, match the button style on /pricing

**Changes:**
- Text changed from "Daftar Sekarang Juga!!" to **"Mulai gratis"**
- Background color from `#FF2D55` to `#0F62FE`
- Text size from 20px to 16px
- Vertical padding from 20px to 12px, horizontal from 48px to 24px
- Corner radius from 0px to 8px
- Applies to **all similar elements** (4)

_Screenshot available in Figval: FV-1_

<details>
<summary>Technical details</summary>

- ID: FV-1
- Selector: `section.hero > div > a.btn-primary`
- `data-testid="hero-cta"`

```html
<a class="btn-primary hero__cta" data-testid="hero-cta" href="/signup">Daftar Sekarang Juga!!</a>
```
</details>

### 2. Hero headline
**Note:** Is this claim backed by anything we can show?

<details>
<summary>Technical details</summary>

- ID: FV-2
- Selector: `section.hero h1`

```html
<h1>Ship faster</h1>
```
</details>

### 3. Footer signup link
**Note:** Keep the muted tone here

**Changes:**
- Background color from `#FF2D55` to `#6B7280`

<details>
<summary>Technical details</summary>

- ID: FV-4
- Selector: `footer a.btn-primary`

```html
<a class="btn-primary footer__cta" href="/signup">Daftar</a>
```
</details>

---

## Pricing (`/pricing`)

### 4. Plan heading
**Changes:**
- Text changed from "Choose a plan" to **"Pick a plan"**

<details>
<summary>Technical details</summary>

- ID: FV-3
- Selector: `main h2`

```html
<h2>Choose a plan</h2>
```
</details>
