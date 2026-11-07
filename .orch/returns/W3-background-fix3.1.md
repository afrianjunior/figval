## Node Return — W3-background-fix3 attempt 1
status: done

### Implemented graph
```ts
updateNote(id, patch, tabId?, lock) =
  findNote (unlocked read) → planAfter [tabOnPage(senderTab ?? active) → capture → putAfter]   // outside permit, only if edits changed
  → lock[ findNote → stale? → NoteRepo.replace → SessionRepo.replace → (stale ? discardCreated : dropOldAfter) ]
  .tapError(discardCreated)
deleteNote(id) = findNote → SessionRepo.replace(noteOrder - id) → NoteRepo.remove → removeShots (rollback, best effort)
router: NoteUpdate leaves SERIALISED and gets lock; NoteCreate/MissingReport prefer senderTab(ctx) over req.tabId
```

### Files
| path | action | purpose |
| src/background/note-service.ts | edit | F1 recapture outside lock, F2 delete order, F3 tab |
| src/background/router.ts | edit | F1 lock plumbing, F3 sender tab, F9 sender preference |
| src/background/test-harness.ts | edit | holdUiHide gate, breakWrites.shotRemoveMany |
| src/background/note-service.test.ts | edit | slow-capture/SessionRename, sender tab, stale note, delete fault tests |
| src/background/hardening.test.ts | edit | F9 test |

### Exports
updateNote(id, patch, tabId?, lock?) (new optional params); rollback unchanged; harness gains holdUiHide() and breakWrites.shotRemoveMany.

### Errors handled
| error tag | strategy | where |
| NoteNotFound | escape (NoteSaveError) | findNote in updateNote/deleteNote |
| capture/ShotStore failure on recapture | catchAll -> keep old shots (divergent, commented) | planAfter |
| write failure inside permit | discard newly created after shot, escape | updateNote tapError |
| ShotStore.removeMany failure on delete | rollback: log warning, delete succeeds | deleteNote |

### Verification
| command | exit | tail |
| vitest src/background --coverage | 0 | 53 passed; Lines 98.48% |
| eslint src/background --max-warnings 0 | 0 | clean |
| tsc --noEmit \| grep src/background | - | no output |

### Coverage
Statements 97.26, Branches 94.89, Functions 94.2, Lines 98.48 (src/background). Temp coverage dir deleted.

### Deviations
- If the note changed meanwhile (updatedAt differs), the patch is re-applied on the fresh note keeping its stored shots; a newly created after shot is discarded. An after shot overwritten in place (existing id) cannot be undone.
- Dropping the old after shot (edits cleared) now happens after the save, best effort, instead of before.

### Needs
none
