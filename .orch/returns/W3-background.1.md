## Node Return — W3-background attempt 1
status: done

### Implemented graph
```ts
main() → ManagedRuntime(BackgroundLive = StorageLive ∪ PlatformLive ∪ MessengerLive).runFork(program)
program (Scope)
  → Messenger.serve('background', asHandler(ctx))      // handle(req): Effect<unknown, {_tag,message?}, HandleEnv>
  → SidePanel.setPanelBehavior(true)
  → Stream.runDrain ×4 (unbounded)
      Action.onClicked      → Activation.ensure(tab.id,'action')      [catchAll → logWarning]
      Commands.onCommand 'pick' → Tabs.queryActive → ensure(…,'command')
      Tabs.onRemoved        → SessionStore.remove(missing:<id>) → clearActivation
      Tabs.activeChanges    → clearIfOriginChanged(tab)
handle(req) = dispatch(req).pipe(mapError(toReplyError))   // NoteSaveError{reason} → {_tag: reason}; content tags die InvariantViolation
  ActivateTab → ensureActivation(tabId, via)
      Tabs.get → unsupportedUrl ? fail UnsupportedPage
      → Scripting.injectContent(tabId, Messenger.toContent(Ping,{300ms,0 retries}))
           .pipe(retry spaced 300ms ∩ recurs 1)   // InjectionFailed retry ×1 then escape
      → toContent(PickerStart) → SessionStore.set(activation:<tabId>,{tabId,origin,active:true})
  NoteCreate → createNote(draft, tabId?)
      SettingsRepo.get → (screenshots ? resolveTab(tabId ?? active) → captureShots : noShots)
      captureShots: UiHide → [hasEdits: EditsOff → grab(before) ensuring EditsOn → sleep 550ms → grab(after)
                              | grab once → before] → Ids.shotId → ShotStore.put (removeMany on failure)
                    .ensuring(UiShow) .catchAll → noShots (log)         // CaptureFailed/ShotStoreError/Messaging escape
      → ensureActive (SessionRepo.get | startSession: Ids.sessionId, defaultSessionName, SessionRepo.insert, SettingsRepo.put)
      → NoteRepo.insert(seq = nextSeq) → SessionRepo.replace(nextSeq+1, noteOrder+id, updatedAt)
      .tapError(ShotStore.removeMany(shots)) .mapError(NoteSaveError{reason: tag})
  NoteUpdate → findNote (scan sessions) → applyPatch → (edits changed ? recaptureAfter : same shots) → NoteRepo.replace → SessionRepo.replace(updatedAt)
      recaptureAfter: !hasEdits → ShotStore.remove(after); else active tab on same page key → captureCurrent → ShotStore.replace|put; any failure keeps old shots
  NoteDelete → findNote → NoteRepo.remove → ShotStore.removeMany → SessionRepo.replace(noteOrder without id)
  SessionCreate/Rename/Delete(cascadeDeleteSession; active → latest updatedAt | null)/Activate, SettingsUpdate(merge, put)
  MissingReport → SessionStore.set(missing:<tabId ?? active tab>, ids)
```
```ts
// Tests: same graph; R swapped in src/background/test-harness.ts
makeStorageMemory(fault) + spy ShotStore(memory) + PlatformTest({tabs, now: Nov 7 2026, IdsSequence}) + makeMessengerLoopback()
  fake content handler (records UiHide/EditsOff/EditsOn/UiShow/Ping/PickerStart) + background served via asHandler
```

### Files
| path | action | purpose |
| --- | --- | --- |
| src/background/keys.ts | created | activation:<tabId>, missing:<tabId>, originOf |
| src/background/activation.ts | created | ensureActivation, clearActivation, clearIfOriginChanged |
| src/background/capture.ts | created | captureShots, captureCurrent, CAPTURE_GAP |
| src/background/note-service.ts | created | createNote, updateNote, deleteNote |
| src/background/sessions.ts | created | session + settings handlers |
| src/background/router.ts | created | handle, asHandler, HandleEnv |
| src/background/main.ts | modified | BackgroundLive, program, main() |
| src/background/index.ts | modified | barrel |
| src/background/test-harness.ts | created | test layers/harness |
| src/background/{note-service,flows,main}.test.ts | created | 34 tests |
| src/entrypoints/background.ts | unchanged | defineBackground(() => main()) |
| .orch/returns/W3-background.1.md | created | this return |

### Exports
- ensureActivation(tabId, via) — Effect<void, UnsupportedPage|InjectionFailed|MessagingError|StorageError, Tabs|Scripting|Messenger|SessionStore> — F1
- clearActivation(tabId), clearIfOriginChanged(tab) — Effect — session-storage cleanup
- captureShots(target, withEdits) — Effect<Shots, never, Messenger|Capture|Ids|ShotStore> — never fails (escape to no shots)
- captureCurrent(target) — Effect<Blob, …> — single fresh shot
- createNote(draft, tabId?), updateNote(id, patch), deleteNote(id) — Effect<…, NoteSaveError, …> — single writer
- createSession, renameSession, deleteSession, activateSession, updateSettings — session/settings handlers
- handle(req), asHandler(ctx), HandleEnv — router
- activationKey, missingKey, noShots, CAPTURE_GAP, CaptureTarget
- main(), program, BackgroundLive

### Errors handled
| error tag | strategy | where |
| --- | --- | --- |
| UnsupportedPage | escape | ensureActivation (also unreadable tab) |
| InjectionFailed | retry ×1 after 300 ms, then escape | injectWithRetry |
| MessageTimeout/RemoteFailure (UiHide, EditsOff…) | escape → note saved without shots; UiShow/EditsOn always restored via ensuring | captureShots |
| CaptureFailed, ShotStoreError (capture) | escape → shots {null,null}; partial shots removed | captureShots |
| StorageQuotaExceeded/StorageUnavailable/StorageCorrupt | escape; reply tag passed through; shots rolled back | createNote, router |
| NoteNotFound / SessionNotFound | escape (NoteSaveError{reason}) → reply tag = reason | updateNote, deleteNote, sessions |
| re-capture failure on update | escape (keeps old shots) | recaptureAfter |
| content-only tag at background | die InvariantViolation | router dispatch |
| action/command/nav/close stream failures | escape (logWarning, stream continues) | main |

### Verification
| command | exit | tail |
| --- | --- | --- |
| npx vitest run src/background --coverage --coverage.include='src/background/**' (with --coverage.reportsDirectory in scratchpad: shared ./coverage dir collided with parallel workers) | 0 | 3 files, 34 tests passed; Statements 98.19%, Branches 94.38%, Functions 96.94%, Lines 98.95% (285/288) |
| npm run typecheck | 0 | wxt prepare ok, tsc --noEmit clean |
| npx eslint src/background src/entrypoints/background.ts --max-warnings 0 | 0 | no output |
| npm run build | 0 | Built extension; background.js 262.97 kB; total 1.06 MB |

### Coverage
src/background: lines 98.95, statements 98.19, branches 94.38, functions 96.94 (uncovered: main.ts 63-64 main() body, capture.ts 59, sessions.ts 60 defensive branches).

### Deviations
- §5 F2 / inputs: serve handler has no sender, so NoteCreate without `tabId` falls back to the active tab (Tabs.queryActive); no readable tab means no capture, note still saved. Same fallback for MissingReport.
- Inputs (rect): no rect on NoteCreate; capture crops the viewport rect {0,0,viewport.w,viewport.h} with dpr from draft.page, i.e. the full visible tab.
- Checklist 1: Permissions.ensureOrigin is not called anywhere in background (panel path proceeds, per card). `via` is only a log annotation. No markersOnly variant.
- Checklist 2: replies for note errors carry the underlying tag (e.g. StorageQuotaExceeded, NoteNotFound, SessionNotFound) instead of tag NoteSaveError, because the messenger reply carries only {tag, message} and NoteSaveError.reason would be lost. Internally NoteService E is NoteSaveError{reason}.
- Checklist 2: update re-captures `after` only when the active tab shows the same page key (normalizePageKey) and the edits changed; if edits are cleared, the after shot is removed and set to null. Element presence is not asked of content.
- Checklist 3: without edits the single shot is stored in `before`. The 550 ms gap is an Effect.sleep inside grabBlobs, between the two grabs (not in a .pipe); captures are not rate-limited across separate notes.
- Checklist 5: handle takes only `req` (Handler has no sender).
- Checklist 6: no Tabs.onUpdated stream exists; origin-change clearing uses Tabs.activeChanges, so it only fires for the active tab. setAccessLevel is not called (SessionStore has no such method).
- Checklist 4: SessionCreate without a name uses the active tab host (empty host when no tab).

### Needs
- W2-storage: `SessionStore.setAccessLevel('TRUSTED_AND_UNTRUSTED_CONTEXTS')` (or equivalent in the SessionStoreLive layer) so content scripts can read drafts; background main cannot call chrome directly.
- W2-messaging-platform: `Tabs.onUpdated` stream ({tabId, status, url}) so activation is cleared for background tabs too; optionally expose `sender` (tab id) to Messenger.serve handlers, or a `rect` field on NoteCreate to crop to the target element.
- Shared vitest coverage dir `./coverage` collides when workers run coverage in parallel (use --coverage.reportsDirectory per worker).
