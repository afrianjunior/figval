## Node Return — W1-copy-fix4 attempt 1
status: done

### Implemented graph
```ts
errors.{UnsupportedPage,CaptureFailed,NoteNotFound,DownloadFailed}
panel.toolbar.helper.{inactive,active,unsupported}
panel.states.notActivated.action, panel.states.otherSession.action
panel.states.notFound.explanation, panel.detail.notFoundExplanation
tooltip.status.{reapplied,elementGone}
```

### Files
| path | action | purpose |
| src/copy/errors.ts | edit | F3, F5, F6, F7 values |
| src/copy/panel.ts | edit | F3, F4, F10, F11 values |
| src/copy/tooltip.ts | edit | F1, F2 values |
| src/copy/strings.test.ts | edit | new round-2 test plus updated shared not-found expectation |

### Exports
- errors.UnsupportedPage and panel.toolbar.helper.unsupported: "Figval can't run on this page. Switch to a regular website tab to pick elements."
- errors.CaptureFailed: 'The note was saved without a screenshot.'
- errors.NoteNotFound: 'That note no longer exists. Pick another note from the list.'
- errors.DownloadFailed: "The download didn't finish. Try again, or use Copy markdown."
- panel.toolbar.helper.inactive: 'Pick an element or select text on the page.'
- panel.toolbar.helper.active: 'Click an element or select text on the page to add a note.'
- panel.states.notActivated.action: 'Show on page'; otherSession.action: 'Open session'
- not-found explanations (panel.states.notFound.explanation, panel.detail.notFoundExplanation): "Figval can't find this element on the page anymore. The page may have changed. The note is still saved, along with any screenshot."
- tooltip.status.reapplied: 'The element changed, so Figval reapplied your edits.'
- tooltip.status.elementGone: "Figval can't find this element on the page anymore. You can still save your note as a comment."

### Errors handled
| error tag | strategy | where |
| UnsupportedPage, CaptureFailed, NoteNotFound, DownloadFailed | wording now states what happened plus a next step | src/copy/errors.ts |

### Verification
| command | exit | tail |
| npx vitest run src/copy src/markdown | 0 | Test Files 8 passed (8); Tests 108 passed (108) |
| npx eslint src/copy --max-warnings 0 | 0 | no output |
| npx tsc --noEmit \| grep src/copy | n/a | printed nothing |

### Coverage
n/a

### Deviations
none (wording applied exactly; markdownHuman untouched; ElementNotFound error left as is since not in scope). Prettier ran only on src/copy.

### Needs
none
