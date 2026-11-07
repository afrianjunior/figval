## Node Return — W3-content-core-fix1 attempt 1
status: done

### Implemented graph
```ts
// new src/content/picker/figval-ui.ts
isFigvalHost(node): tag figval-root || [data-fv-host]
isFigvalEvent(event): isFigvalHost(target) || composedPath().some(isFigvalHost)
PICKER_YIELD_EVENT = 'figval:picker-yield'
// picker: onMove/onClick/onKey return early on isFigvalEvent; listens PICKER_YIELD_EVENT -> finish()
// selection: onMouseUp ignores isFigvalEvent; "+ Note" click opens tooltip then dispatches PICKER_YIELD_EVENT on doc
```

### Files
| path | action | purpose |
| src/content/picker/figval-ui.ts | added | any-host composedPath check + yield event name |
| src/content/picker/picker.ts | edited | use isFigvalEvent in pointermove/click/keydown; stop on yield event |
| src/content/picker/selection.ts | edited | isFigvalEvent in mouseup; "+ Note" signals picker to stop |
| src/content/picker/picker.test.ts, selection.test.ts | edited | two-host test; "+ Note" while picking test |

### Exports
unchanged (figval-ui is internal, not re-exported)

### Errors handled
| error tag | strategy | where |
| n/a | n/a | n/a |

### Verification
| command | exit | tail |
| npx vitest run src/content | 0 | 9 files, 116 tests passed |
| npm run typecheck | 0 | clean |
| npx eslint src/content/picker src/content/markers --max-warnings 0 | 0 | clean |
| npm run e2e | 0 | 8 passed |

### Coverage
n/a

### Deviations
- main.ts untouched, so the picker-stop on "+ Note" is signalled via a document CustomEvent (`figval:picker-yield`) the picker listens to, instead of an option wired from main.
- Hover outline guard is the pointermove ignore (figval-root never becomes state.current).

### Needs
none
