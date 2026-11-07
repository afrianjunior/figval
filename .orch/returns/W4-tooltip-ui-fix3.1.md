## Node Return — W4-tooltip-ui-fix3 attempt 1
status: done

### Implemented graph
```ts
openSession = loadBoot -> acquireOverlayHost -> buildCtx -> makeActions -> mountView -> startFollow
              -> wireFinalizers(ctx, view, [wireStore, watchElement, installKeyHandler])   // all fns < 50 lines
loadBoot(reopen) = findNote(activeSession) -> else sessions.list -> notes.get per other session
                   -> none: Effect.logWarning + null
TooltipView = <span.fv-tip__notch data-side> + <div.fv-tip data-side>   // CSS places notch per side, hidden on dock
```

### Files
| path | action | purpose |
|---|---|---|
| src/content/tooltip/controller.ts | edit | F5: extracted buildCtx, installKeyHandler, wireFinalizers; behavior unchanged |
| src/content/tooltip/boot.ts | edit | F10: findNote searches all sessions; warning on miss |
| src/content/tooltip/boot.test.ts | add | 4 tests (active, switched, null active, not found + warning) |
| src/content/tooltip/components/TooltipView.tsx | edit | UI-9: notch element, data-side from placement (dock when undefined) |
| src/content/tooltip/tooltip.css | edit | UI-9: 8px rotated notch, per-side placement, hidden on dock |
| src/content/tooltip/components/TooltipView.test.tsx | edit | notch attribute/CSS tests per side |

### Exports
unchanged

### Errors handled
| error tag | strategy | where |
|---|---|---|
| RepoReadError (sessions.list) | divergent: treated as no other sessions | boot.ts findNote |
| RepoReadError (notes.get) | orNone degrade | boot.ts findNote |
| note not found | Effect.logWarning, return null | boot.ts loadBoot |

### Verification
| command | exit | tail |
|---|---|---|
| npx vitest run src/content/tooltip | 0 | Test Files 5 passed (5); Tests 76 passed (76) |
| npx eslint src/content/tooltip --max-warnings 0 | 0 | no output |
| npx tsc --noEmit 2>&1 \| grep src/content/tooltip | - | no output |

### Coverage
n/a

### Deviations
- findNote uses NoteRepo.get per session rather than NoteRepo.list (same result, cheaper).
- Notch is a sibling of .fv-tip (inside the slot) because .fv-tip has overflow:hidden; it is painted under the card so only the outer half shows. It has no animation, so reduced motion is respected by construction; the notch is static (transform: rotate only).
- Notch hairline uses var(--c-line); card has no border, only shadow.

### Needs
none
