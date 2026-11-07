## Node Return — W5-integration-e2e attempt 1
status: done

### Implemented graph
```ts
// Harness: serve.mjs (node:http, 127.0.0.1:4173) -> playwright webServer
// fixtures.ts: launchPersistentContext(.output/chrome-mv3-test) -> serviceWorker -> extensionId
//   harness { openFixture(name) -> {page, tabId}, openPanel(tabId, width), readClipboard, storage }
// Scenario graph: panel Pick -> page hover/click -> tooltip(shadow) -> save -> panel rows -> export/clipboard
// Wiring (src/content/main.ts): ContentLive = makeContentLive(options)
//   repos = merge(SettingsRepoLive, SessionRepoLive, NoteRepoLive) provided ChromeStorageLive
//   base = merge(MessengerLive, SessionStoreLive, repos)
//   merge(base, makeTooltipPortLive({ resolveAsset }).pipe(provide(base)))   // replaces TooltipPortNoop
```

### Files
| path | action | purpose |
|---|---|---|
| playwright.config.ts | modified | webServer, baseURL, timeouts |
| tests/e2e/serve.mjs | created | static fixture server |
| tests/e2e/fixtures.ts | created | extension context, harness, queryTabs |
| tests/e2e/helpers.ts | created | pick/save/edit/export helpers |
| tests/e2e/{pick-comment,edit-export,selection,spa,states,sessions,screenshots}.spec.ts | created | scenarios 1-8 |
| tests/e2e/__screenshots__/*.png | created | panel 320/360/420 and tooltip, light/dark (8 PNGs) |
| src/content/main.ts | modified | wiring-only: real tooltip layer + repos over ChromeStorageLive |

### Exports
fixtures.ts: test, expect, copy, queryTabs. helpers.ts: overlay, pickElement, commentAndSave, copyLlm, applyStyleEdit, chooseSimilar, saveEdit, setBeforeAfter, rows, computed.

### Errors handled
| error tag | strategy | where |
|---|---|---|
| none (test code) | die (assertion failure) | specs use expect.poll, no sleeps |

### Verification
| command | exit | tail |
|---|---|---|
| npm run typecheck | 0 | WXT types generated, no tsc errors |
| npm run lint | 0 | eslint --max-warnings 0 clean |
| npm test | 0 | 44 files, 703 tests passed |
| npm run build | 0 | Total size 1.57 MB |
| npm run e2e | 0 | 8 passed (25.4s) |

### Coverage
e2e: 8 passed / 0 fixme / 8 total (scenario 8 is one test producing 8 PNGs).

### Deviations
- Clipboard permission granted context-wide (no origin): Chromium rejects granting to chrome-extension:// origins.
- Selection scenario (3): picker is cancelled with Esc before selecting text; while the picker is active, clicking "+ Note" is intercepted by the picker (target resolved to `figval-root`, empty draft). Not treated as a blocking bug since real flow selects text after picking, but worth a look.
- Scenario 5 uses about:blank (chrome:// not opened).
- Scenario 7: New session and activating a session both return to the list automatically, so no Back click.
- Delete (6) triggered via Delete key on the row button.
- Tooltip lives in a second `figval-root` host (created per tooltip); markers/"+ Note" in the first. Locators rely on shadow piercing across both.
- Chromium (full + headless shell) installed to the Playwright cache; no package.json change.

### Needs
none (optional: picker should ignore clicks on its own host when "+ Note" is pressed during picking: src/content/picker/picker.ts, scenario 3 variant).
