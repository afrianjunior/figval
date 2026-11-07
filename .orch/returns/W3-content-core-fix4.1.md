## Node Return — W3-content-core-fix4 attempt 1
status: done

### Implemented graph
```ts
// markers.ts: PREVIEW_FLIP_TOP removed; PREVIEW_GAP=6, PREVIEW_FALLBACK_HEIGHT=64
previewHeight(slot) = .fv-pin__preview rect height || 64
place(): below when y - previewHeight - 6 < 0   (right rule unchanged)
replace(noteId) -> place(entry); called from onPointerEnter and onFocus (re-measure when visible)
```

### Files
| path | action | purpose |
| src/content/markers/markers.ts | edit | measured-height flip, re-evaluate on hover/focus |
| src/content/markers/markers.test.ts | edit | 2 tests: short preview stays above; tall preview at y=42 flips below |

### Exports
unchanged

### Errors handled
| error tag | strategy | where |
| none new | n/a | n/a |

### Verification
| command | exit | tail |
| npx vitest run src/content | 0 | 9 files, 125 tests passed |
| npx eslint src/content/markers --max-warnings 0 | 0 | clean |
| npm run typecheck | 0 | clean |
| npm run e2e | 0 | 16 passed; pin-hover-light.png shows FV-2 preview fully visible below the pin |

### Coverage
n/a

### Deviations
Tests dispatch a bubbling `pointerover` (React's pointerenter source) on the pin button. Zero-height fallback (64 px) applies before hover, so the first render of near-top pins flips conservatively.

### Needs
none
