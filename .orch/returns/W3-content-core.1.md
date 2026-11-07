## Node Return — W3-content-core attempt 1
status: done

### Implemented graph
```ts
main(opts{resolveAsset}, onInvalidated)            // guard: globalThis.__figvalContent
  → Effect.scoped(startContent) ← MessengerLive + SessionStoreLive + TooltipPortNoop
startContent(opts): Effect<ContentApp, never, Scope | Messenger | SessionStore | TooltipPort>
  → acquireOverlayHost({doc, resolveAsset})        // Scope: <figval-root> + shadow(uiCss+overlay.css) + doc @font-face once
  → makeEditRegistry(doc)
  → makeMarkerLayer({doc, host, registry})         // Scope: scroll/resize listeners, ResizeObserver, pins
      render(notes) → findElement per note → mountPin (Pin primitive, flushSync) → registry.apply if hasEdits
                    → missing → Messenger.toBackground(MissingReport{ids}) (forkDaemon, failure → logWarning)
      hover/focus → SessionStore.set('hover', {noteId, at}|null) (errors ignored); click → TooltipPort.openTooltip(reopen)
      highlight / scrollTo (scrollIntoView + pulse) / clear / reopen / elementOf
  → pickerController: PickerStart → closes old scope, startSelection once (app scope), Scope.make → startPicker
      startPicker (Scope, TooltipPort): capture pointermove/click/keydown + scroll/resize, rAF outline+chip
        click/Enter → buildTarget(el) → TooltipPort.openTooltip({mode:'new'}) → onFinish → scope closed
        Esc → onFinish; ArrowUp/Down → pure up()/down() on PickerState
      startSelection (Scope, TooltipPort): selectionchange/mouseup → "+ Note" → buildTarget(nearestBlock(range), range) → openTooltip
  → watchReapply(registry, doc, markers.elementOf)
  → Messenger.serve('content', handle)             // Ping, PickerStart/Stop, UiHide/Show, EditsOff/On, MarkersRender/Clear, Highlight, ScrollTo, TooltipReopen
```
```ts
Tests: same graph with makeMessengerLoopback + SessionStoreMemory + recording TooltipPort layer (picker/test-support.ts); happy-dom DOM.
```

### Files
| path | action | purpose |
| src/content/picker/tooltip-port.ts | created | TooltipPort tag, TooltipOpenOptions, TooltipPortNoop |
| src/content/picker/overlay-host.ts | created | shadow host, fonts, hide/show, owns(event) |
| src/content/picker/overlay.css | created | overlay CSS (outline, chip, corners, hint, +Note, pin slot, pulse) |
| src/content/picker/outline-box.ts | created | selection-blue outline box with tag.class and W x H chip |
| src/content/picker/picker-state.ts | created | pure hover/up/down state |
| src/content/picker/picker.ts | created | startPicker |
| src/content/picker/selection.ts | created | startSelection ("+ Note") |
| src/content/picker/raf.ts | created | rAF coalescing scheduler |
| src/content/picker/test-support.ts | created | recording port, harness, note fixtures for tests |
| src/content/picker/index.ts | modified | barrel |
| src/content/picker/{picker,selection}.test.ts | created | 13 tests |
| src/content/markers/markers.ts, pin-view.tsx, index.ts | created/modified | marker layer, Pin mount, barrel |
| src/content/markers/{markers,router}.test.ts | created | 15 tests (router tests live here; verify command only globs picker/markers) |
| src/content/main.ts | modified | startContent, router, main with double-injection guard |
| src/entrypoints/content.ts | modified | passes browser.runtime.getURL and ctx.onInvalidated |

### Exports
picker barrel: TooltipPort, TooltipPortNoop, TooltipOpenOptions; acquireOverlayHost(opts) — Effect<OverlayHost, never, Scope>; startPicker(opts) — Effect<void, never, Scope|TooltipPort>; startSelection(opts) — same; createOutlineBox, tagLabel, makeFrameScheduler; initialPickerState/hover/up/down.
markers barrel: makeMarkerLayer(opts) — Effect<MarkerLayer, never, Scope|Messenger|SessionStore|TooltipPort> with render/clear/highlight/scrollTo/reopen/elementOf/notes; HOVER_KEY ('hover'); mountPin.
main.ts: startContent(opts), main(opts, onInvalidated?), CONTENT_FLAG.

### Errors handled
| error tag | strategy | where |
| ElementNotFound (findElement null) | escape: collected into MissingReport | markers.render |
| MessageTimeout / MessageDecodeError / RemoteFailure on MissingReport | escape: logWarning, forked daemon so render never blocks | markers.report |
| StorageUnavailable / StorageQuotaExceeded on hover write | escape: Effect.ignore | markers.writeHover |
| unknown/other-direction requests | escape: no-op reply | main.handle |

### Verification
| command | exit | tail |
| npx vitest run src/content/picker src/content/markers | 0 | Test Files 4 passed; Tests 28 passed |
| npm run typecheck | 0 | wxt prepare ok, tsc --noEmit clean |
| npx eslint src/content/picker src/content/markers src/content/main.ts src/entrypoints/content.ts --max-warnings 0 | 0 | clean |
| npm run build | 0 | Built chrome-mv3; content-scripts/content.js 615.91 kB |

### Coverage
Not requested.

### Deviations
- §10.1/checklist 4: ArrowUp/Down walk elements via parentElement/firstElementChild (same bounds as parentTarget/childTarget) instead of calling them, since the picker needs elements, not Targets.
- Pins are the real `Pin` primitive mounted via react-dom createRoot + flushSync into one `.fv-slot` per note (positioned by transform).
- Marker hover only highlights locally and writes the `hover` key; it does not send Highlight, to avoid a panel/page feedback loop.
- MissingReport is sent whenever notes.length > 0, including an empty ids list, so the background can clear stale missing flags; tabId omitted.
- MarkersClear also removes all note edits from the registry.
- Text selection is armed on the first PickerStart (that is the activation) and stays armed for the page lifetime.
- Router tests sit in src/content/markers/router.test.ts because I own no other folder for them.
- Preview truncation appends a literal ellipsis glyph (not a copy string).

### Needs
- Copy: none missing for the picker (copy.picker.* and copy.keys.* used). Pin preview falls back to target.label when comment is empty.
- W5: swap TooltipPortNoop in main.ts's ContentLive for the W4 layer; fonts must be listed in web_accessible_resources (wxt.config already has fonts/* and assets/*, confirm the emitted font paths match).
- Note: I ran `prettier --write src/content` once; it may have re-formatted files under src/content/edit (no semantic change).
