## Node Return — W5-integration-e2e-fix1 attempt 1
status: done

### Implemented graph
```ts
// tests/e2e/screenshots-states.spec.ts (7 tests, each saves light + dark PNGs via emulateMedia)
tooltip-edit-{light,dark}       // Edit tab, text+bg+font-size changed, Reset all + changed dots
tooltip-color-{light,dark}      // Background color popover open
panel-detail-{light,dark}       // Detail: Text, Fill, Typography, Layout sections (420x1400)
panel-detail-hidden-{light,dark}// extra: Detail with Text + Visibility (see Deviations)
picker-{light,dark}             // picker active, hovering hero CTA, outline + label chip
pin-hover-{light,dark}          // FV-2 pin on promo banner (right edge) hovered, preview visible
panel-search-{light,dark}       // 5 notes, search bar + chips, "comment" chip pressed
panel-firstrun-{light,dark}
panel-unsupported-{light,dark}  // about:blank
```

### Files
| path | action | purpose |
|---|---|---|
| tests/e2e/screenshots-states.spec.ts | added | captures a-h, 7 tests |
| tests/e2e/__screenshots__/*.png | added/regenerated | 26 PNGs (original 8 regenerated, 18 new) |

### Exports
none

### Errors handled
| error tag | strategy | where |
|---|---|---|
| none (test code) | deterministic waits only: expect visibility/aria-pressed/poll computed opacity === '1'; strings from copy | screenshots-states.spec.ts |

### Verification
| command | exit | tail |
|---|---|---|
| npm run e2e | 0 | 16 passed (41.8s) |
| ls tests/e2e/__screenshots__ | 0 | 26 PNGs (panel-{320,360,420,detail,detail-hidden,firstrun,search,unsupported}, picker, pin-hover, tooltip, tooltip-color, tooltip-edit, each -light/-dark) |
| npx eslint tests/e2e --max-warnings 0 | 0 | no output |
| npm run typecheck | 0 | WXT types generated, no errors |

### Coverage
e2e 16/16 pass (was 9; +7). PNG count 26 (was 8).

### Deviations
- Item c: a single note cannot hold style and hidden edits, because hiding drops style edits by design (src/content/edit/diff.ts:33). panel-detail-{scheme}.png shows Text/Fill/Typography/Layout; an extra panel-detail-hidden-{scheme}.png shows Text/Visibility. Together they cover all five sections.
- Item e: one pin is hovered per shot (FV-2 on the banner, right edge); FV-1 is visible un-hovered.
- Existing screenshots.spec.ts left unchanged; its 8 PNGs regenerate on run.

### Needs
- Product bug (not changed): pin-hover preview for the promo-banner pin is clipped at the top of the viewport (visible in pin-hover-{light,dark}.png). place() in src/content/markers/markers.ts flips the preview below only when y < PREVIEW_FLIP_TOP (40), but this pin sits at y ~ 42 and a two-line preview is taller than that, so it renders above and is cut off. Raising PREVIEW_FLIP_TOP (or measuring preview height) would fix it.
- Cosmetic: the color popover in tooltip-color covers the Font size row beneath it (src/ui/composite.css .fv-color__pop); likely intended as an overlay, noted for the reviewer.
