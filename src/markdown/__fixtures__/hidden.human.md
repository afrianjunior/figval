# Website review: example.com

**Date:** 7 November 2026 · **Notes:** 2 · **Pages:** 1
**Screen size during review:** 1440×900
**Page:** https://example.com/

## Summary
- 1 style change
- 2 elements removed
- 1 comment

---

### 1. Cookie banner
**Note:** Covers the signup button on mobile

**Changes:**
- Element removed

_Screenshot available in Figval: FV-1_

<details>
<summary>Technical details</summary>

- ID: FV-1
- Selector: `div.cookie-banner`
- `role="dialog"`
- `name="cookies"`

```html
<div class="cookie-banner" role="dialog">We use cookies</div>
```
</details>

### 2. Promo strip
**Note:** Remove, then fix the spacing

**Changes:**
- Vertical padding from 12px to 0px
- Element removed

<details>
<summary>Technical details</summary>

- ID: FV-2
- Selector: `div.promo`
</details>
