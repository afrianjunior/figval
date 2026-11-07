## Node Return — W1-design-system-fix2 attempt 1
status: done

### Implemented graph
UI-1 `.fv-btn__kbd` opacity removed (full on-accent colour). UI-2 `.fv-toast :focus-visible { outline-color: var(--c-surface) }`. UI-4 new token `--font-kbd` used by `.fv-kbd` and `.fv-btn__kbd`. UI-5 `data-edge~=right|below` rules for `.fv-pin__preview`. UI-9 Pin useId -> aria-describedby/id. UI-10 ScrubNumber Esc stopPropagation when draft non-null. UI-11 chip height var(--control-h). UI-12 Segmented selected = raised + accent ring + accent text + 600 weight.

### Files
| path | action | purpose |
| src/ui/controls.css | edit | UI-1, UI-4, UI-11, UI-12 |
| src/ui/tokens.css | edit | add --font-kbd (additive) |
| src/ui/overlay.css | edit | UI-2 |
| src/ui/composite.css | edit | UI-5 |
| src/ui/primitives/Pin.tsx | edit | UI-9 |
| src/ui/primitives/ScrubNumber.tsx | edit | UI-10 |
| src/ui/primitives.test.tsx | edit | Pin aria-describedby test, ScrubNumber Esc propagation test |

### Exports
No export or prop changes. New CSS token `--font-kbd`.

### Errors handled
n/a (presentational)

### Verification
| command | exit | tail |
| npx vitest run src/ui | 0 | Test Files 4 passed (4); Tests 43 passed (43) |
| npx eslint src/ui --max-warnings 0 | 0 | no output |
| npx tsc --noEmit \| grep src/ui/ | - | prints nothing |

Contrast (antislop-human checker): white on #0a62e0 (primary btn kbd, light) 5.47:1; white on #2f6bdb (dark) 4.94:1; toast outline #f6f6f7 on #1a1b1e (light) 15.94:1; #1f2023 on #ededef (dark) 13.93:1; segmented accent text #0a62e0 on #ffffff 5.47:1, #5b9bff on #2b2c30 5.03:1.

### Coverage
n/a

### Deviations
- UI-4: no font subset bundled; symbol-capable system stack used. Glyphs now render in the UI font fallback chain rather than JetBrains Mono (kbd no longer monospace-styled).
- UI-1: no text-decoration underline existed on `.fv-btn__kbd`; the toast action underline is deliberate and kept.
- Segmented selected-state contrast of accent text vs raised surface checked; ring is --c-accent (>=3:1 both themes).

### Needs
none (W3 must emit `data-edge` on `.fv-slot` for UI-5 rules to take effect)
