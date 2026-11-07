## Node Return — W3-panel-model attempt 1
status: done

### Implemented graph
```ts
createPanelStore(layer: Layer<PanelEnv>, {boundTabId?, boundTabPollMs?})   // ManagedRuntime.make(layer); Scope for timers
  → ref: SubscriptionRef<ModelState>
  → ref.changes → snapshot {model, panel: derivePanelState(model)} → listeners   // useSyncExternalStore
  → startStreams(ctx)   // each loop forkIn(scope); E → errors['storage'] (never escapes)
      SettingsRepo.stream → settings          SessionRepo.stream → sessions
      ref.changes(activeSessionId) ⟶switch NoteRepo.stream(id) + NoteRepo.list (corrupt) → notes, corruptCount
      ref.changes(sessions id:updatedAt) → NoteRepo.list per session → sessionPageCounts
      Tabs.queryActive|get(bound) ⊕ Tabs.activeChanges (⊕ Stream.tick poll when bound) → activeTab (+ unsupportedUrl)
      ref.changes(tabId) ⟶switch SessionStore key stream: activation:<id> | missing:<id>;  SessionStore `hover`
      ref.changes(tab, active, notes, pendingDelete) ⟶switch Messenger.toContent(tab, MarkersRender{page notes})
  → actions (Promise facade over Effect actions, run on the live Runtime)
      pick | showNotes → Permissions.ensureOrigin (first step) → Messenger.toBackground(ActivateTab{via:'panel'})
      updateNote → sleep 400 ms (scoped fiber, per-note merge) → NoteUpdate ; flushNote/back/dispose flush
      deleteNote → pendingDelete + sleep 5 s (scoped fiber) → NoteDelete ; undoDelete interrupts ; 2nd delete commits 1st
      hover → Highlight ; open → ScrollTo + detail ; editOnPage → TooltipReopen ; setBeforeAfter → EditsOff/EditsOn (rollback on failure)
      exportCopy → exportNotes(scope) → Markdown.render → Clipboard.writeText ; exportDownload → Download.markdown(exportFilename)
      copyShot → ShotStore.get → Clipboard.writeImage
      create/activate/rename/deleteSession, updateSettings → toBackground ; search/filter/format/scope/selection/reorder: ref only
```
```ts
// tests: same graph; R = PlatformTest + makeStorageMemory + MessengerLoopback + fake background/content handlers + TestContext (TestClock)
```

### Files
| path | action | purpose |
| --- | --- | --- |
| src/sidepanel/model/state.ts | created | ModelState, initial state, immutable updaters |
| src/sidepanel/model/filter.ts | created | search and filter predicates |
| src/sidepanel/model/selection.ts | created | visible notes, groups, export scope selection, counts |
| src/sidepanel/model/panel-state.ts | created | PanelState / Strip TaggedEnums, Shell, row/group view models |
| src/sidepanel/model/view-model.ts | created | derivePanelState |
| src/sidepanel/model/context.ts | created | PanelEnv, Ctx, constants, toErrorTag, helpers |
| src/sidepanel/model/streams.ts | created | stream wiring |
| src/sidepanel/model/actions*.ts (actions, -page, -notes, -export, -ui) | created | actions |
| src/sidepanel/model/store.ts, hook.ts, index.ts | created/modified | store, usePanelStore, barrel |
| src/sidepanel/model/test-kit.ts, store-kit.ts | created | test harness (fake background/content, boot helper) |
| src/sidepanel/model/view-model.test.ts, store.test.ts | created | 77 tests |
| .orch/returns/W3-panel-model.1.md | created | this return |

### Exports
- createPanelStore(layer, opts?) — PanelStore {getSnapshot, subscribe, actions, ready, run, dispose}
- usePanelStore(store) — {model, panel, actions}
- derivePanelState(ModelState) — PanelState (Loading, FirstRun, EmptySession, Ready, Detail, Sessions, Settings); PanelState, Strip (Data.TaggedEnum constructors)
- exportNotes(model), SEARCH_MIN_NOTES, initialState, activeSessionOf
- types: PanelActions, EffectActions, PanelEnv, ModelState, UiState, Filters, ErrorKey, Shell, RowVm, GroupVm, SessionRowVm, HelperKey, ExportCounts, PanelSnapshot, PanelStoreOptions
- activationKey, missingKey, HOVER_KEY, UNDO_WINDOW_MS, NOTE_DEBOUNCE_MS

### Errors handled
| error tag | strategy | where |
| PermissionDenied (local or remote) | escape → activation.permissionDenied | pick/showNotes |
| UnsupportedPage (local or remote) | escape → activation.unsupported | pick/showNotes |
| InjectionFailed (remote) | escape → activation.injectionFailed (retry x1 lives in background) | pick/showNotes |
| MessageTimeout / RemoteFailure / any other | escape → ui.errors[key] = tag (retry x2 inside Messenger) | every messaging action, markers, hover/scroll |
| ClipboardDenied | escape → errors.export / errors.copyShot | exportCopy, copyShot |
| ShotStoreError | escape → errors.copyShot | copyShot |
| StorageCorrupt / StorageUnavailable (streams) | escape → errors.storage; per-session count/corrupt reads degrade to 0 | streams |
| unknown tags | folded to InvariantViolation | toErrorTag |

### Verification
| command | exit | tail |
| --- | --- | --- |
| npx vitest run src/sidepanel/model --coverage --coverage.include='src/sidepanel/model/**' | 0 | 2 files, 77 tests passed; Lines 98.85%, Stmts 98.12%, Branch 96.47%, Funcs 97.53% |
| npm run typecheck | 0 | wxt prepare ok, tsc --noEmit clean |
| npx eslint src/sidepanel/model --max-warnings 0 | 0 | clean |

### Coverage
src/sidepanel/model: lines 98.85, statements 98.12, branches 96.47, functions 97.53 (includes test-kit.ts).

### Deviations
- Checklist 1: `activeSession` is derived (`activeSessionOf`) rather than stored, to avoid duplicated state. Added `loaded`, `sessionPageCounts`, `localOrder`, `confirmDeleteSession` to the model.
- Checklist 2: added a `Loading` PanelState (before first settings/sessions emission) to avoid a FirstRun flash. FirstRun/EmptySession carry no strip. Single strip shown: NotActivated wins; OtherSession only when the active session has no notes on the page, choosing the session with most notes there. Other-session counts recomputed when the sessions list changes (id:updatedAt key) via NoteRepo.list per session.
- Checklist 3: store exposes `ready` and `run` (tests drive TestClock). Snapshot is `{model, panel}`. In bound-tab mode the tab is polled every `boundTabPollMs` (default 1000) because Tabs.activeChanges only emits the focused tab.
- Checklist 4: only one pending delete at a time (a new delete commits the previous at once). reorder is local-only. `back` flushes pending autosaves; `dispose` flushes autosaves and commits a pending delete. `hover`/`open`/`editOnPage`/`EditsOff|On` message the page only when Figval is active on the tab. SessionCreate is followed by SessionActivate (idempotent if background activates itself). `flashId` is a transient success marker ('export-copy', 'export-download', 'shot:<id>:<which>') cleared after 1.5 s. Delete-session confirmation is model state (request/cancel/deleteSession).
- Design 5: `Permissions.ensureOrigin` is the first effect of pick; once the store is ready, actions run synchronously via `Runtime.runPromise` on the built runtime (before ready they fall back to ManagedRuntime).

### Needs
- Protocol: `SessionReorder{id, noteOrder}` (W2-messaging-platform + W3-background) so reorder can persist; model keeps `localOrder` until then.
- W3-background: must write `activation:<tabId>` = {tabId, origin, active}, `missing:<tabId>` and `hover` = {noteId|null, at} to SessionStore as stated; ActivateTab remote failure tags PermissionDenied/UnsupportedPage/InjectionFailed are mapped to toolbar state.
- Optional: a `Tabs.updates(tabId)` stream would replace bound-tab polling.
