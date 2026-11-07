## Node Return — W3-background-fix1 attempt 1
status: done

### Implemented graph
```ts
createNote(draft, tabId?, rect?) → shotsFor(…, rect) → captureTarget(tab, page, rect) → rect: cropRect(rect, page.viewport) → captureShots
  cropRect: undefined → viewport; else pad CROP_PADDING=4 CSS px each side, clamp to [0,viewport]; empty after clamp → viewport
  updateNote → recaptureAfter → captureTarget(tab, page) (no rect → viewport crop)
dispatch SessionReorder → reorderSession(id, noteOrder)
  requireSession → isPermutation(current, next) ? : fail NoteSaveError{InvalidOrder}
  → Clock.now → SessionRepo.replace({noteOrder, updatedAt}) → Session
program: allowContentAccess (logged) → SidePanel.setPanelBehavior → drain ×4
  onNavigation = Tabs.onUpdated ▸ filter(status==='loading' && url) ▸ decode TabId ▸ clearIfOriginChanged(tabId, url)
     → origin differs from activation:<id> → SessionStore.remove(missing:<id>) → clearActivation   [catchAll → logWarning]
  (activeChanges path removed: no double logic)
```

### Files
| path | action | purpose |
| --- | --- | --- |
| src/background/capture.ts | modified | CROP_PADDING, cropRect |
| src/background/note-service.ts | modified | rect threaded through createNote/shotsFor/captureTarget |
| src/background/sessions.ts | modified | reorderSession |
| src/background/router.ts | modified | SessionReorder case, rect to createNote |
| src/background/activation.ts | modified | clearIfOriginChanged(tabId, url) also clears missing key |
| src/background/main.ts | modified | onUpdated navigation stream, allowContentAccess at startup |
| src/background/test-harness.ts | modified | SessionStoreMemory(fault) so contentAccessGrants is observable |
| src/background/{flows,main,note-service}.test.ts | modified | tests for all four changes (39 total) |

### Exports
- cropRect(rect | undefined, viewport) → Rect; CROP_PADDING = 4
- createNote(draft, tabId?, rect?)
- reorderSession(id, noteOrder)
- clearIfOriginChanged(tabId, url) (signature changed from TabInfo)

### Errors handled
| error tag | strategy | where |
| --- | --- | --- |
| NoteSaveError{InvalidOrder} | escape (reply tag InvalidOrder) | reorderSession |
| SessionNotFound | escape | reorderSession |
| StorageUnavailable from allowContentAccess | escape (logWarning, startup continues) | program |
| onUpdated handler failure | escape (logWarning, stream continues) | onNavigation |

### Verification
| command | exit | tail |
| --- | --- | --- |
| npx vitest run src/background --coverage … | 0 | 3 files, 39 tests passed; Lines 99.05%, Stmts 98.32%, Branch 94.39%, Funcs 97.08% |
| npm run typecheck | non-zero | only errors in src/sidepanel/model/** (actions-notes.ts, selection.ts, view-model.test.ts; W3-panel-model-fix1's files); 0 errors in src/background or src/entrypoints/background.ts |
| npx eslint src/background src/entrypoints/background.ts --max-warnings 0 | 0 | clean |
.orch/tmp-cov-bg deleted.

### Coverage
Lines 99.05% (313/316), statements 98.32%, branches 94.39%, functions 97.08%.

### Deviations
- Crop padding: 4 CSS px per side (CROP_PADDING), clamped to viewport. A rect that falls fully outside the viewport falls back to the whole viewport crop (smallest-scope choice).
- Re-capture on NoteUpdate has no rect: keeps viewport crop.
- Invalid reorder: NoteSaveError{reason:'InvalidOrder'} (reply tag InvalidOrder); unknown session gives SessionNotFound.
- Reorder duplicates or unknown ids count as non-permutation.
- Test harness overrides SessionStore with SessionStoreMemory(fault) because makeStorageMemory(control) does not pass its control to SessionStoreMemory.
- The Tabs.activeChanges navigation path was removed from main (onUpdated replaces it); activeChanges still exists upstream, unused here.

### Needs
- src/storage/layers.ts (owner: storage): makeStorageMemory(control) should call SessionStoreMemory(control) so FaultControl.contentAccessGrants() works through the standard layer. Currently harmless here due to the harness override.
- Typecheck is red only from src/sidepanel/model/**; re-run once W3-panel-model-fix1 settles.
