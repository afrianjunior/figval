## Node Return — W3-background-fix2 attempt 1
status: done

### Implemented graph
```ts
asHandler(context): one Effect.unsafeMakeSemaphore(1).withPermits(1) per runtime (lock)
  (req, ctx) => handle(req, ctx, lock) ; SERIALISED tags run under lock
  NoteCreate: settings.get -> shotsFor(capture, OUTSIDE permit) -> lock[ settings.get -> ensureActive -> insertNote ]
              tabId = req.tabId ?? ctx.senderTabId ?? active tab
  MissingReport: tabId = req.tabId ?? ctx.senderTabId ?? active tab
  insertNote: NoteRepo.insert -> SessionRepo.replace | tapError -> rollback(NoteRepo.remove) (+ removeShots)
  startSession/createSession: SessionRepo.insert -> SettingsRepo.put | tapError -> rollback(SessionRepo.remove)
  onUpdated: loading+url -> clearIfOriginChanged ; complete -> reinjectIfActive (activation active + same origin -> injectWithRetry(ping first), no PickerStart)
```

### Files
| path | action | purpose |
|---|---|---|
| src/background/router.ts | edit | ctx-aware handler, semaphore, sender-tab fallback |
| src/background/note-service.ts | edit | Lock type, capture outside permit, compensation, rollback helper |
| src/background/sessions.ts | edit | createSession compensation |
| src/background/activation.ts | edit | reinjectIfActive |
| src/background/main.ts | edit | navigation stream handles complete |
| src/background/capture.ts | edit | divergent comments, logWarning on restore failure |
| src/background/index.ts | edit | new exports |
| src/background/test-harness.ts | edit | senderTabId option, breakWrites fault flags |
| src/background/hardening.test.ts | new | F1/F3/F4/F6 tests |

### Exports
`Lock`, `identityLock`, `rollback` (note-service), `reinjectIfActive`; `createNote(draft, tabId?, rect?, lock?)`; `handle(req, ctx?, lock?)`; `asHandler` now returns `(req, ctx) => ...`.

### Errors handled
| error tag | strategy | where |
|---|---|---|
| repo failure after NoteRepo.insert / SessionRepo.insert | escape after compensating remove; undo failure logged (divergent) | note-service, sessions |
| restore UiShow/EditsOn failure | log warning + swallow (divergent) | capture.ts |
| shot cleanup failure | log warning (divergent) | capture.ts |
| reinject/navigation failures | log via `logged` | main.ts |

### Verification
| command | exit | tail |
|---|---|---|
| vitest src/background --coverage | 0 | 48 tests passed (4 files) |
| eslint src/background src/entrypoints/background.ts --max-warnings 0 | 0 | no output |
| tsc --noEmit grep background | - | prints nothing |

### Coverage
Statements 97.19%, Branches 95%, Functions 94.02%, Lines 98.11% (tmp dir deleted).

### Deviations
- All mutating requests except NoteCreate are locked in asHandler; NoteCreate takes the lock itself after capture. NoteUpdate holds the permit during its best-effort recapture (spec: wrap every mutating request).
- Exported `handle` (used directly by tests) is unlocked unless a lock is passed.
- Reinject on `complete` skips when the tab URL is unsupported or origin differs (no clearing there; `loading` already clears).
- Ran prettier --write only on src/background.

### Needs
none
