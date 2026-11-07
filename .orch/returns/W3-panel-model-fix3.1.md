## Node Return — W3-panel-model-fix3 attempt 1
status: done

### Implemented graph
```ts
// Undo timer: running (deleteTimer fiber) <-> paused (deletePaused, no fiber); pendingDelete stays set
deleteNote -> commitPendingDelete -> cancelDebounce(id) -> set pendingDelete -> startDeleteTimer
pauseUndo  : deleteTimer? -> interrupt, deleteTimer=null, deletePaused=true   (else no-op)
resumeUndo : deletePaused? -> refresh pendingDelete.until=now+UNDO_WINDOW_MS -> startDeleteTimer (else no-op)
commitDelete: cancelDebounce(id) -> NoteDelete   (E: catchAll -> failTo('delete'); ensuring clears pendingDelete)
commitPendingDelete / undoDelete: act on running OR paused window
```

### Files
| path | action | purpose |
|---|---|---|
| src/sidepanel/model/actions-notes.ts | edit | cancelDebounce, startDeleteTimer, pauseUndo, resumeUndo; commit/undo handle paused state |
| src/sidepanel/model/actions.ts | edit | pauseUndo/resumeUndo on EffectActions (and PanelActions via mapped type) |
| src/sidepanel/model/context.ts | edit | Ctx.deletePaused flag |
| src/sidepanel/model/store.ts | edit | init deletePaused: false |
| src/sidepanel/model/store.test.ts | edit | 7 new tests (TestClock): pause/resume, undo while paused, second delete, no-ops, resume w/o pause, dispose while paused, edit-then-delete sends no NoteUpdate |

### Exports
PanelActions / EffectActions: added `pauseUndo(): Promise<void>` and `resumeUndo(): Promise<void>`. Ctx gains `deletePaused: boolean` (internal). Nothing removed.

### Errors handled
| error tag | strategy | where |
|---|---|---|
| any NoteDelete failure | escape to error key 'delete' via failTo (unchanged) | commitDelete |

### Verification
| command | exit | tail |
|---|---|---|
| npx vitest run src/sidepanel/model --coverage ... | 0 | 2 files, 95 tests passed |
| npx eslint src/sidepanel/model --max-warnings 0 | 0 | clean |
| npx tsc --noEmit \| grep src/sidepanel/model | - | prints nothing |

### Coverage
Statements 98.29%, Branches 95.11%, Functions 98.1%, Lines 99.29% (temp dir removed).

### Deviations
- resumeUndo also refreshes `ui.pendingDelete.until` to now + UNDO_WINDOW_MS so any countdown display stays truthful.
- deleteNote drops a note's pending autosave at start (per contract); an Undo afterwards restores the note without that last unsent edit.

### Needs
none
