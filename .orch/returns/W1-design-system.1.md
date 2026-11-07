## Node Return — W1-design-system attempt 1
status: done

### Implemented graph
```ts
uiCss (css.ts) → ?inline[tokens.css, base.css, controls.css, composite.css, overlay.css]   // sidepanel: import; tooltip: inject into shadow root
fonts.ts → fontFaces[?url woff2] → buildFontFaceCss(resolve) → @font-face text (sidepanel: identity, tooltip: chrome.runtime.getURL)
ScrubNumber → pointerdown(handle) → setPointerCapture → pointermove → scrubValue(start, dx, step, shift, range) → onChange → pointerup/cancel → releasePointerCapture
ScrubNumber → keydown(Arrow±) → nudgeValue(Shift ×10) ; typed draft → parseNumber → clamp → onChange on Enter/blur, Esc reverts
Segmented → keydown(Arrow) → stepIndex (wraps, skips disabled) → onChange + focus
Dialog → open → remember opener (shadow-root aware) → focus first focusable → Tab trap → Esc → onClose → cleanup focuses opener
ColorRow → swatch toggles popover(swatches + native color) ; hex → normalizeHex → onChange ; Esc / outside pointerdown closes
production: index.ts barrel → primitives/*.tsx → cx / icons / scrub (pure)
```

### Files
| path | action | purpose |
| src/ui/tokens.css | created | light/dark tokens on :root and :host, reduced-motion overrides |
| src/ui/base.css | created | .fv-root reset, focus ring, sr-only, forced-colors |
| src/ui/controls.css | created | button, iconbutton, field, input, textarea, select, checkbox, segmented, slider, scrub, swatch, badge, chip, kbd |
| src/ui/composite.css | created | section, property row, color row, layer row, pin |
| src/ui/overlay.css | created | toast, dialog, skeleton, keyframes |
| src/ui/css.ts | created | uiCss string via ?inline |
| src/ui/fonts.ts | created | font ?url imports, fontFaces, fontUrls, buildFontFaceCss |
| src/ui/assets.d.ts | created | ?url and ?inline module types |
| src/ui/icons.tsx | created | Icon wrapper (16 px, 1.5 stroke) and chosen icon map |
| src/ui/cx.ts, scrub.ts | created | class join; pure scrub/nudge/clamp/parse math |
| src/ui/primitives/*.tsx (21) | created | Button, IconButton, Field(+Input), Textarea, Checkbox, Segmented, Slider, ScrubNumber, ColorRow, PropertySection, PropertyRow, LayerRow, Pin, Select, Swatch, Badge, Chip, Kbd, Toast, Dialog, Skeleton |
| src/ui/index.ts | modified | barrel |
| src/ui/{scrub,fonts,tokens}.test.ts, primitives.test.tsx | created | 41 tests |

### Exports
- uiCss — string — tokens + primitives CSS for shadow-root injection
- buildFontFaceCss — (resolve: (assetPath: string) => string) => string — @font-face CSS, font-display swap
- fontFaces, fontUrls — FontFace[] / string[] — font metadata and emitted URLs
- Icon, icons, ICON_SIZE, ICON_STROKE — {icon: LucideIcon} wrapper and name→glyph map
- cx, clamp, snap, scrubValue, nudgeValue, parseNumber, normalizeHex — pure helpers
- Button, IconButton(label required), Field, Input, Textarea, Checkbox, Segmented<T>, Slider(label required), ScrubNumber, ColorRow, Swatch, PropertySection, PropertyRow, LayerRow, Pin, Select, Badge, Chip, Kbd, Toast, Dialog, Skeleton — presentational, strings via props, className passthrough, forwardRef where focus matters

### Errors handled
| error tag | strategy | where |
| none (no Effect, no chrome APIs; non-goal) | n/a | invalid typed numbers and hex revert to the last valid value (ScrubNumber, ColorRow) |

### Verification
| command | exit | tail |
| npm run typecheck && npx vitest run src/ui | 0 | Test Files 4 passed (4), Tests 41 passed (41) |
| npm run lint | 0 | eslint . --max-warnings 0, no output |
| npm run build | 0 | Built extension; Total size 187.74 kB (src/ui is not yet imported by an entrypoint) |
Extra: a Vite lib build of src/ui/index.ts confirmed uiCss contains :host and .fv-btn and fonts resolve.

### Coverage
Not requested.

### Deviations
- §10.1 / R-03 tap targets: controls are 28 px (spec density) rather than 44 px; this is a desktop side panel and in-page tooltip.
- §10.1 icons: Lucide used as the spec and task dictate; antislop flags its look, so the glyph choice is by relevance (Crosshair for pick, MessageSquare for comment, Pencil for edit, EyeOff for hide, RotateCcw for reset).
- Inter is used for UI as the spec allows (small-size density); JetBrains Mono for IDs and values.
- Added Input as an extra primitive (hex field, search need it).
- Dark/light follow prefers-color-scheme only; no manual theme toggle.
- Vitest does not process CSS, so uiCss content is checked by reading tokens.css and by a one-off Vite build, not in a unit test.
- Dialog renders in place (position: fixed) instead of a portal so it works inside the tooltip's shadow root.
- No dev gallery added.

### Needs
- Consumers: side panel imports `uiCss` into a style tag and `buildFontFaceCss(p => p)`; tooltip injects `uiCss` into its shadow root and a document-level style from `buildFontFaceCss(chrome.runtime.getURL)`; wrap UI in an element with class `fv-root`.
- Vite emits font files under `assets/` (manifest web_accessible_resources already covers it).
