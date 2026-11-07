## Node Return — W1-design-system-fix3 attempt 1
status: done

### Implemented graph
```ts
// CSS: .fv-btn .fv-kbd {color:inherit}; primary .fv-kbd = var(--c-on-accent); ghost/secondary = muted
// CSS: .fv-scrub .fv-scrub__input:focus-visible {outline:none}
// tokens: --font-kbd mono-first
// CSS: .fv-pin__btn min-height 24px; .fv-iconbtn--xs 24px
// Pin: useState(dismissed); onKeyDown Escape -> true; onPointerLeave/onBlur -> false;
//      root data-dismissed; hover/focus-within reveal rule gated by :not([data-dismissed])
```

### Files
| path | action | purpose |
|---|---|---|
| src/ui/controls.css | edit | UI-1 kbd colors, UI-5 scrub focus, UI-8 xs 24px |
| src/ui/tokens.css | edit | UI-6 --font-kbd mono first |
| src/ui/composite.css | edit | UI-8 pin 24px min height, Esc-dismiss gating |
| src/ui/primitives/Pin.tsx | edit | dismissed state, Esc/blur/pointer-leave handlers |
| src/ui/primitives.test.tsx | edit | Pin Esc test |

### Exports
unchanged (Pin props unchanged; user onKeyDown/onBlur still forwarded)

### Errors handled
| error tag | strategy | where |
|---|---|---|
| none (pure UI) | n/a | n/a |

### Verification
| command | exit | tail |
|---|---|---|
| npx vitest run src/ui | 0 | Test Files 4 passed (4); Tests 44 passed (44) |
| npx eslint src/ui --max-warnings 0 | 0 | no output |
| npx tsc --noEmit \| grep "src/ui/" | - | no output |

Contrast (antislop-human checker, normal text, all PASS):
- Primary kbd #fff on #0a62e0 (light): 5.47:1; on hover #0853bd: 7.04:1
- Primary kbd #fff on #2f6bdb (dark): 4.94:1; on hover #2a5fc2: 5.98:1
- Ghost/secondary muted #5e6169 on #f6f6f7: 5.74:1, on #fff: 6.20:1 (light)
- Muted #a3a6ad on #1f2023: 6.68:1, on #2b2c30: 5.72:1 (dark)
- Danger (inherits --c-missing) #b3261e on #f6f6f7: 6.05:1; #ff8a80 on #1f2023: 7.14:1

### Coverage
n/a

### Deviations
- Danger buttons have no solid fill (text-colored), so --c-on-accent (white) would fail on the surface; danger kbd inherits the danger text color instead (passes both themes).
- Pin dismissal is exposed as data-dismissed on the .fv-pin root; CSS is the only hide mechanism (jsdom test asserts the attribute).

### Needs
none
