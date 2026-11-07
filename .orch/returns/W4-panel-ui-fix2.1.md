## Node Return — W4-panel-ui-fix2 attempt 1
status: done

### Implemented graph
```ts
Delete key (NoteRow) -> focusNeighbor(li): next row main | prev row main | group heading (tabindex -1 if h3) -> actions.deleteNote
App: effect while shell.pendingDelete !== null: Cmd/Ctrl+Z (not in input/textarea) -> actions.undoDelete()
Toasts: container aria-live="polite"
DetailChanges: change.property -> copy.tooltip.edit.controls.* label; "→" aria-hidden + sr-only copy.panel.detail.changeTo
Toolbar: kbd = isMac() ? keys.toggleShortcut : keys.toggleShortcutOther (isMac exported from hooks.ts, same detection as searchHint)
```

### Files
| path | action | purpose |
|---|---|---|
| src/sidepanel/ui/focusNeighbor.ts | new | focus next/prev row or heading before delete |
| src/sidepanel/ui/NoteRow.tsx | edit | call focusNeighbor on Delete |
| src/sidepanel/ui/App.tsx | edit | Cmd/Ctrl+Z undo binding |
| src/sidepanel/ui/Toasts.tsx | edit | aria-live polite |
| src/sidepanel/ui/DetailChanges.tsx | edit | copy labels, glyph arrow + sr-only word |
| src/sidepanel/ui/panel.css | edit | arrow pseudo-element removed, colour kept on span |
| src/sidepanel/ui/Toolbar.tsx, hooks.ts | edit | platform shortcut |
| src/sidepanel/ui/App.test.tsx | edit | 6 new tests, 2 updated (51 total) |

### Exports
hooks.ts: `isMac` now exported. New `focusNeighbor(row: HTMLElement): void`.

### Errors handled
| error tag | strategy | where |
|---|---|---|
| none new | n/a | n/a |

### Verification
| command | exit | tail |
|---|---|---|
| npx vitest run src/sidepanel/ui | 0 | Test Files 2 passed; Tests 51 passed |
| npx eslint src/sidepanel/ui src/entrypoints/sidepanel --max-warnings 0 | 0 | no output |
| npx tsc --noEmit \| grep sidepanel paths | n/a | prints nothing |

### Coverage
n/a

### Deviations
- Delete via the Detail view button/menu is unchanged (Detail unmounts and existing useFocusReturn applies); only the list-row Delete key got neighbour focus.
- Cmd/Ctrl+Z is ignored when focus is in an input/textarea so native text undo keeps working.
- Toast text still read from copy (unchanged key `toasts.deleted`).

### Needs
none (copy keys toggleShortcutOther and changeTo had landed)
