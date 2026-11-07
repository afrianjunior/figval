## Node Return — W1-copy-fix3 attempt 1
status: done

### Implemented graph
```ts
// src/copy: C1-C9, C11-C14 applied; 4 new error tags; panel.detail.changeTo; keys.toggleShortcutOther
```

### Files
| path | action | purpose |
| src/copy/errors.ts | edit | C1, C2, C3, C5, 4 new tags and lines |
| src/copy/panel.ts | edit | C1-C4, C6, C7, C12, C14, changeTo |
| src/copy/tooltip.ts | edit | C2, C8, C9, C11, C13 |
| src/copy/strings.test.ts | edit | tests written first for every change |

### Exports
- errors.PermissionDenied, panel.toolbar.helper.permissionDeclined: "Site access was declined, so Figval can't pick elements here. Choose Try again to allow it." (retry label panel.toolbar.retry = 'Try again')
- errors.NoteSaveError, tooltip.status.saveFailed, panel.states.storageError.line: "The note wasn't saved. Your changes are still here, so try again."
- errors.ElementNotFound: "Figval can't find this element on the page anymore. The page may have changed. The note is still saved."
- panel.states.notFound.explanation, panel.detail.notFoundExplanation: "Figval can't find this element on the page anymore. The page may have changed. The note and its screenshot are still saved."
- panel.toolbar.helper.injectionFailed: "Figval couldn't start on this page. Reload the page and try again."
- errors.ShotStoreError: "The screenshot couldn't be saved or loaded. The note is still saved."
- panel.settings.corrupt: "couldn't be read"
- panel.sessions.deleteDialog.body(n): n=0 "This deletes the session. This can't be undone."; else "This deletes {the note | all N notes} and every screenshot in this session. This can't be undone."
- keys.toggleShortcutOther: 'Alt+Shift+F'
- tooltip.edit.controls: paddingVertical 'Vertical padding', paddingHorizontal 'Horizontal padding', radius 'Corner radius', textAlign 'Text alignment'
- toasts.deleted 'Note deleted'; toasts.downloaded 'Markdown downloaded'
- panel.states.noResults.line: `No notes match "${query}".`; filterLine 'No notes match these filters.'
- tooltip.comment.placeholder 'What should change?'
- panel.detail.copyBefore 'Copy before screenshot'; copyAfter 'Copy after screenshot'
- panel.detail.changeTo 'to'
- errors.NoteNotFound: "That note no longer exists. It may have been deleted. Pick another note from the list."
- errors.SessionNotFound: "That session no longer exists. Pick another one from the session switcher, or start a new one."
- errors.InvalidOrder: "The notes couldn't be reordered. Drag the note again."
- errors.DownloadFailed: "The download didn't finish. Copy markdown still works."
- ERROR_TAGS now also includes NoteNotFound, SessionNotFound, InvalidOrder, DownloadFailed.

### Errors handled
| error tag | strategy | where |
| NoteNotFound, SessionNotFound, InvalidOrder, DownloadFailed | user-facing line with next step | src/copy/errors.ts |

### Verification
| command | exit | tail |
| npx vitest run src/copy | 0 | Test Files 3 passed, Tests 20 passed |
| npx eslint src/copy --max-warnings 0 | 0 | no output |
| npx tsc --noEmit \| grep src/copy | - | no output |
| npx vitest run src/markdown | 0 | Test Files 5 passed, Tests 87 passed |

### Coverage
n/a

### Deviations
- Existing strings.test.ts assertions for noResults line/filterLine updated to the new periods (C12).
- tooltip.status.saveFailed previously "Couldn't save. ..."; now the C2 line exactly.
- panel.ts "Screenshots can't be recovered." removed per C7 wording.
- C10 and C15 untouched; markdownHuman untouched.
- Wording of the four new error lines is my own (no spec text given).
- prettier --write run on src/copy only.

### Needs
none
