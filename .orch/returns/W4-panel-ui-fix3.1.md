## Node Return — W4-panel-ui-fix3 attempt 1
status: done

### Implemented graph
```ts
usePauseHandlers(onPause, onResume) -> {onPointerEnter,onPointerLeave,onFocus,onBlur}  // paused = hovered || focusWithin
UndoToast: pause -> actions.pauseUndo(), resume -> actions.resumeUndo()
ErrorToast: paused state gates the 8 s setTimeout effect; leave re-runs effect = full window
SearchBar: .fvp-search__chips > 3 x .fvp-search__group (flex-wrap); divider = border-left on group + group
panel.css: .fvp .fvp-note {padding} (0,2,0), .fvp-toolbar .fvp-note {padding:0} later, still wins
```

### Files
| path | action | purpose |
|---|---|---|
| src/sidepanel/ui/usePause.ts | create | hover/focus-within pause hook |
| src/sidepanel/ui/Toasts.tsx | edit | UndoToast component, error toast pause |
| src/sidepanel/ui/SearchBar.tsx | edit | chip groups, no separator nodes |
| src/sidepanel/ui/panel.css | edit | note padding fix, group divider |
| src/sidepanel/ui/App.test.tsx | edit | 6 new tests (57 total) |

### Exports
unchanged (ERROR_TOAST_MS still exported from Toasts.tsx).

### Errors handled
| error tag | strategy | where |
|---|---|---|
| none new (pause/resume are void; promises discarded like other actions) | n/a | Toasts.tsx |

### Verification
| command | exit | tail |
|---|---|---|
| npx vitest run src/sidepanel/ui | 0 | Test Files 2 passed; Tests 57 passed (57) |
| npx eslint src/sidepanel/ui src/entrypoints/sidepanel --max-warnings 0 | 0 | no output |
| npx tsc --noEmit \| grep sidepanel/ui\|entrypoints/sidepanel | - | no output |

### Coverage
n/a

### Deviations
- Pause signal is hover OR focus-within (resume only when both are gone); blur inside the toast does not resume.
- Wrapped-group divider shows at line start if a group wraps; accepted per spec.

### Needs
none
