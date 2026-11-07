## Node Return — W4-tooltip-ui attempt 1
status: done

### Implemented graph
```ts
TooltipPortLive = makeTooltipPortLive()          // Layer<TooltipPort, never, Messenger | SessionStore | SettingsRepo | SessionRepo | NoteRepo>
  → Layer.scoped: captures the 5 services as TooltipDeps; one open tooltip at a time; finalizer = closeCurrent
  openTooltip(target, opts) → closeCurrent → Scope.make → openSession({deps,target,opts,resolveAsset,scope}) ⊂ Scope.extend(scope)
    openSession: Effect<TooltipHandle|null, never, Scope>
      → loadBoot(SettingsRepo.get ▸ SessionRepo.get(nextSeq) | NoteRepo.get(reopen) ▸ SessionStore draft)   // storage errors degrade to defaults, never fail
      → registry.remove(noteId) in reopen (so baseline is the true look)
      → acquireOverlayHost (Scope; own <figval-root>, uiCss + doc @font-face once) + tooltip.css style in the shadow root
      → makeStore(initialState(computeBaseline, findSimilar, defaultTab(preset,lastTooltipTab), note|draft))   // pure reducer
      → makePreviewer (edit.preview/revert) · makeMatchHighlighter · makeDraftWriter(400ms debounce → SessionStore) · makeTextRow (startTextEdit in a child Scope)
      → mountView: React root in .fv-tip-slot → TooltipView {Header, TabBar, CommentTab, EditTab{PropertySection groups, ScopeRow}, Footer}
      → startFollow (Scope): rAF-coalesced scroll/resize/ResizeObserver → place() right→left→below→above→dock, drag offset, off-screen hint
      → wireStore: controls/elementStatus → preview; tab → Messenger SettingsUpdate (forked, logWarning); dirty → draft schedule
      → watchElement: MutationObserver → findElement → re-apply "reapplied" | "gone" (Edit tab disabled)
      → document keydown Esc → escapeOutcome: close | arm | discard
      → Actions: save = Messenger.toBackground(NoteCreate{draft,rect} | NoteUpdate{id,patch}) → finish(revert preview, registry.apply(note.id, el, note.edits), clear draft, restore focus, Scope.close)
                 .pipe(catchAll → dispatch saveFailed(tag))   cancel = finish(revert, reopen: re-apply original note edits)
```
```ts
Tests: same graph with fake TooltipDeps (vi.fn Messenger.toBackground, SessionStoreMemory, stub repos), happy-dom, shadow root queried via figval-root.shadowRoot.
```

### Files
| path | action | purpose |
| src/content/tooltip/index.ts | modified | barrel |
| src/content/tooltip/layer.ts | created | TooltipPortLive / makeTooltipPortLive |
| src/content/tooltip/controller.ts | created | openSession assembly |
| src/content/tooltip/session.ts | created | TooltipDeps + SessionCtx types |
| src/content/tooltip/actions.ts | created | save / cancel / requestClose, single-close guard |
| src/content/tooltip/view.tsx | created | React mount + props wiring |
| src/content/tooltip/boot.ts | created | settings, seq, reopen note, draft loading |
| src/content/tooltip/store.ts | created | reducer-backed store |
| src/content/tooltip/preview.ts | created | live preview over the edit engine |
| src/content/tooltip/matches.ts | created | outline boxes for "All similar (N)" hover |
| src/content/tooltip/follow.ts | created | scroll follow, drag offset, placement callbacks |
| src/content/tooltip/textrow.ts | created | scoped startTextEdit session |
| src/content/tooltip/drafts.ts | created | draft read/write/clear + debounced writer |
| src/content/tooltip/save.ts | created | NoteDraft/NotePatch builders, failure tag |
| src/content/tooltip/position.ts (+test) | created | pure placement |
| src/content/tooltip/tooltip.css | created | tooltip styling on Figval tokens |
| src/content/tooltip/model/{state,selectors,draft,tab,fixtures}.ts, state.test.ts | created | pure reducer, selectors, draft schema, default tab |
| src/content/tooltip/components/{TooltipView,Header,TabBar,CommentTab,EditTab,ScopeRow,Footer}.tsx, TooltipView.test.tsx | created | UI + component tests |
| src/content/tooltip/controller.test.tsx | created | session integration tests |

### Exports
- TooltipPortLive — Layer<TooltipPort, never, Messenger | SessionStore | SettingsRepo | SessionRepo | NoteRepo> — W5 swaps this for TooltipPortNoop.
- makeTooltipPortLive — (options?: { resolveAsset?: (path) => string }) => same layer — resolveAsset only matters if the page has no Figval fonts yet.
- openSession — (SessionInput) => Effect<TooltipHandle | null, never, Scope> — used by the layer; exported for tests.
- place, Box, Placement, Side — pure placement.
- draftKey — (url) => string — session-storage key `draft:<host><path>`.
- defaultTab — (preset, last) => TooltipTab.
- types: TooltipLayerOptions, SessionInput, TooltipDeps, TooltipHandle.

### Errors handled
| error tag | strategy | where |
| RemoteFailure{tag} (e.g. StorageQuotaExceeded) | escape: keep content, show copy.errors[tag] above Save | actions.save, Footer |
| MessageTimeout / MessageDecodeError | escape: same path, tag = _tag (copy.errors has both) | actions.save |
| unknown tag | escape: copy.tooltip.status.saveFailed | Footer |
| SettingsUpdate failure (tab) | escape: logWarning | controller.wireStore |
| StorageUnavailable/QuotaExceeded on draft write/clear | escape: logWarning | drafts.ts |
| StorageCorrupt/Unavailable on settings/session/note/draft read | escape: defaults / none (note missing in reopen -> tooltip does not open) | boot.ts |
| element detached, locator miss | escape: status 'gone', Edit tab disabled, comment save allowed | watch.ts |

### Verification
| command | exit | tail |
| npx vitest run src/content/tooltip | 0 | Test Files 4 passed (4); Tests 57 passed (57) |
| npm run typecheck | 0 | wxt prepare ok, tsc --noEmit clean |
| npx eslint src/content/tooltip --max-warnings 0 | 0 | no output |
| npm run build | 0 | Built chrome-mv3; content-scripts/content.js 616.46 kB (tooltip not bundled until W5 wires the layer) |

### Coverage
Not requested.

### Deviations
- Checklist 1: `components/` has an extra TabBar.tsx; `model/` also holds selectors, draft schema and default-tab helper. controller is split into controller/actions/view/watch/session/boot for the <50-line rule (openSession itself is still ~75 lines of assembly).
- Overlay host: the layer opens its own `acquireOverlayHost` per tooltip (same HOST_TAG and data-fv-host) because the host created by startContent is not exposed via a service. The document font style is injected once and reused.
- Esc: header close button uses the same "ask once, then discard" rule as Esc; Cancel button discards immediately. The Esc listener is on `document` (bubble), so ScrubNumber's own Escape also reaches it.
- Text row: a Textarea in the Edit tab; page element becomes contenteditable (startTextEdit) only while that textarea has focus, and typing in either stays in sync. A first `preview()` at open records originals so text revert is exact.
- Draft: one draft per page (`draft:<host><path>`), offered only when its target selector matches; kept while the tooltip is closed via scope (not via Cancel/Save), cleared on Save/Cancel/Discard.
- ColorRow needs four a11y strings (swatch button, hex, picker, swatches); copy has none, so the control label is reused for all four.
- Skills: only `antislop` was loaded; antislop-ui/-human/-copywriting/humanizer were not invoked. No new strings were written (everything comes from src/copy); UI reuses src/ui primitives and tokens.
- Font-weight options and the S / R scrub handles are bare numerals/letters, not copy.
- "Dirty" is computed against the opening snapshot (label, comment, why, forceApply, diff), so reopening a note unchanged is clean.

### Needs
- W5: in src/content/main.ts replace TooltipPortNoop with `makeTooltipPortLive({ resolveAsset })` (or TooltipPortLive) and provide SettingsRepo, SessionRepo, NoteRepo (ChromeStorageLive-backed) alongside Messenger and SessionStore.
- Copy (optional): dedicated accessible names for the color row (swatch button, hex field, picker, page swatches) and for the font-weight select if you want distinct labels.
- Background: must grant content access to chrome.storage.session (allowContentAccess) so drafts persist; without it draft writes only log a warning.
