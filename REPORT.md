# Figval v1 - Build Report

## 1. Status

**Complete. No nodes are BLOCKED.** All nodes in the §12 execution graph finished; all gates G0-G6 passed. Checkpoint commits are on the local branch `main` (never pushed); latest is `7c457d4`.

Done criteria (spec §13):

| Criterion | Result | Evidence |
|---|---|---|
| All gates green: typecheck, lint, test, coverage thresholds, build, e2e | ✓ | Final run by the coordinator: typecheck 0, lint 0 (zero warnings), 47 files / 793 tests pass, coverage 0 with thresholds met, build 0, e2e 16/16 (section 3) |
| Every §10 state reachable and styled; every §6 error mapped to a copy key | ✓ | 26 e2e screenshots cover panel, detail, search, first-run, unsupported, picker, pin hover and tooltip states in light and dark; background replies carry the underlying error tag and the panel/tooltip map tag to copy (W6 copy review PASS) |
| LLM and Human outputs match §11 goldens | ✓ (with documented deviations) | Byte-exact golden tests in `src/markdown` (W2-markdown attempt 2, fix2 hostile golden). Deviations from the §11 text are listed in section 7 |
| Review findings: no CRITICAL/HIGH open | ✓ | Round 1: 2 HIGH, round 2: 1 HIGH; all fixed and verified by gates (section 6). Round-2 MEDIUM items were fixed without a third review (protocol maximum is two rounds) |
| `REPORT.md` written | ✓ | This file |

## 2. How to load the extension

1. `npm install && npm run build`
2. Open `chrome://extensions` and enable Developer mode.
3. Choose Load unpacked and select `.output/chrome-mv3`.

For e2e only: `npm run build:test` writes `.output/chrome-mv3-test`. It adds `host_permissions: <all_urls>` and lets the side panel accept `?tab=<id>`. Do not load the test build for normal use.

## 3. Commands and final results

| Command | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0, zero warnings |
| `npm test` | exit 0; 47 files, 793 tests passed |
| `npm run coverage` | exit 0 with thresholds enforced |
| `npm run build` | exit 0 (`.output/chrome-mv3`) |
| `npm run build:test` | builds `.output/chrome-mv3-test` for e2e |
| `npm run e2e` | 16/16 passed (Chromium, test build, fixtures served locally) |

### Coverage

Totals: Statements 92.02%, Branches 84.38%, Functions 90.88%, Lines 93.01%.

Thresholds (build fails below them):

| Scope | Threshold |
|---|---|
| Global lines / statements / functions | 80 |
| Global branches | 75 |
| `src/domain` | 90 |
| `src/markdown` | 90 |
| `src/locator` | 85 |
| `src/storage` | 85 |
| `src/messaging` | 80 |
| `src/platform` | 80 |
| `src/background` | 80 |
| `src/content/edit` | 85 |
| `src/sidepanel/model` | 85 |

`src/platform/fake-chrome.ts` is excluded from coverage (imported only by tests). `src/platform/test-driver.ts` is not excluded because production platform modules import it (W0-fix2).

### e2e screenshots

26 files in `tests/e2e/__screenshots__`, each in light and dark: panel at 320, 360 and 420 px; detail; search; first-run; unsupported page; picker; pin hover; tooltip comment tab; tooltip edit tab; tooltip color. W5-integration-e2e-fix1 added 18 state screenshots to the initial set; fix2 made screenshots wait for colour-scheme transitions.

## 4. Final graph vs spec

All nodes DONE. "Attempts" counts full node attempts; "fixes" are follow-up fix passes.

| Node | Attempts | Status | Fixes |
|---|---|---|---|
| W0-foundation | 1 | DONE | fix1: `.prettierignore` for goldens; fix2: coverage include/exclude and thresholds |
| W1-domain | 1 | DONE | none |
| W1-design-system | 1 | DONE | fix2 (round-1 UI): kbd contrast, toast focus ring, kbd glyph stack, pin preview edges, Pin `aria-describedby`, ScrubNumber Esc, chip height, segmented accent. fix3 (round-2): kbd colour inside primary buttons, scrub double ring, mono-first kbd font, 24 px targets, pin Esc dismiss |
| W1-copy | 1 | DONE | fix1: pageUrl; fix2: panel/tooltip strings; fix3: round-1 copy findings plus 4 error tags; fix4: round-2 copy findings |
| W2-markdown | 2 | DONE | Attempt 1 failed the gate (goldens copied a Prettier-mangled spec layout). Attempt 2 = fix1: byte-exact templates. fix2: escaping of page-derived text, hostile golden |
| W2-locator | 1 | DONE | none |
| W2-storage | 1 | DONE | fix1: `SessionStore.allowContentAccess`; fix2: memory layer shares `FaultControl` |
| W2-messaging-platform | 1 | DONE | fix1: `NoteCreate.rect`, `SessionReorder`, `Tabs.onUpdated`; fix2: `HandlerContext.senderTabId`, NON_IDEMPOTENT no-retry, `DownloadFailed`, live reply on defect |
| W3-background | 1 | DONE | fix1: rect crop, reorder handler, onUpdated origin clearing, allowContentAccess; fix2: write semaphore, sender tab, re-inject on same-origin reload, compensation on partial failure; fix3: re-capture outside lock, repairable delete order, sender tab for update |
| W3-content-core | 1 | DONE | fix1: ignore clicks inside any Figval host, "+ Note" wins over picker; fix2: always send MissingReport, pin `data-edge`; fix3: release edit registry on scope close; fix4: pin preview flip by measured height |
| W3-edit-engine | 1 | DONE | fix1: per-document store, `disposeEdits` |
| W3-panel-model | 1 | DONE | fix1: persist reorder, bound tab via onUpdated; fix2: `DownloadFailed` handling, resubscribing streams; fix3: pause/resume undo, cancel autosave on delete |
| W4-tooltip-ui | 2 | DONE | Attempt 1 rejected (UI/COPY skills not applied). Attempt 2 = fix1 audit. fix2: scoped fibers, no cancel/save race; fix3: split `openSession`, reopen searches all sessions, notch to pin |
| W4-panel-ui | 2 | DONE | Attempt 1 rejected (Detail "Changes" not split into Figma-like property sections). Attempt 2 = fix1. fix2: focus after delete, Cmd/Ctrl+Z undo, copy labels for properties, platform shortcut; fix3: note padding, toast pause on hover/focus, chip group dividers |
| W5-integration-e2e | 1 | DONE | Wiring-only edit in `src/content/main.ts` (swap `TooltipPortNoop` for the real tooltip layer). fix1: 18 extra state screenshots; fix2: wait for colour-scheme transitions |
| W6 reviews (code, copy, UI) | 2 rounds | DONE | Section 6 |
| W7-report | 1 | DONE | This file |

## 5. Gates

| Gate | Result | Checkpoint commit |
|---|---|---|
| G0 (foundation) | ✓ | `d2739ad` (scaffold commit `e163063`) |
| G1 (domain, design system, copy) | ✓ | `a214ac0` |
| G2 (markdown, locator, storage, messaging-platform) | ✓ after markdown attempt 2 | `25b8a97` |
| G3 (background, content-core, edit-engine, panel-model) | ✓ | `c939619` (upstream fixes `4f2871b`) |
| G4 (tooltip-ui, panel-ui) | ✓ after UI rework | `4815a0d` (pre-gate `ebf4f14`) |
| G5 (integration, e2e) | ✓ | `37648e2` |
| G6 (review fixes, final) | ✓ | `5dfe430` (round 1), `fd1c0ff` (extra e2e, pin flip), `7c457d4` (round 2) |

## 6. Review rounds

| Round | Code | Copy | UI |
|---|---|---|---|
| 1 | FAIL (1 HIGH) | PASS (15 MEDIUM/LOW) | FAIL (1 HIGH) |
| 2 | PASS | PASS | FAIL (1 HIGH) |

HIGH findings and resolution:

| Round | Reviewer | Finding | Resolution |
|---|---|---|---|
| 1 | Code | Unserialised read-modify-write in background | Write semaphore around background mutations (W3-background fix2), plus compensation on partial failure, re-capture outside the lock and repairable delete order (fix3). Verified by gate |
| 1 | UI | Keyboard hint (kbd) contrast too low | kbd contrast fix (W1-design-system fix2). Verified by gate |
| 2 | UI | Save kbd hint at 1.13:1 inside primary buttons | kbd colour inside primary buttons, mono-first kbd font (W1-design-system fix3). Verified by gate |

The 15 round-1 copy findings were applied in W1-copy fix3 (with 4 new error tags). Round-2 copy findings were applied in W1-copy fix4, except the items in section 8. Round-2 MEDIUM items landed in `7c457d4` without a third review; they are covered by unit tests and the full e2e suite.

## 7. Deviations

Format: spec ref -> what differs -> why. Full per-node lists are in the "Deviations" section of each file in `.orch/returns/`.

### Process

- Process (W0): `prettier --write .` ran once and reformatted `p.impl.md` (tables padded, blank lines added; content unchanged) -> the file on disk remains in that form; the original bytes are not recoverable from git. Later workers received the true §11 templates inline; `.prettierignore` now protects goldens, `p.impl.md`, `p.impl.prompt` and `.orch`.
- Process (W2-markdown attempt 1): goldens copied the Prettier-mangled layout -> gate failed; attempt 2 used the true templates.
- Process (W4 attempts 1): tooltip and panel UI first attempts were rejected for not applying UI/COPY skills and for a flat "Changes" section; reworked in attempt 2.
- Process (W1-copy fix1/fix2, W1-design-system, W2-markdown): some tests were written in the same pass as the code, so a separate red run was not captured; W2-markdown relaxed TDD order (golden written from spec first, others generated and reviewed).

### W0-foundation

- §1 TypeScript -> pinned 5.9.3, not 7.0.2 -> typescript-eslint 8.72.0 peer range is below 6.1.0.
- §1 versions -> each dependency pinned to the latest release at least two weeks old (wxt 0.21.4, react 19.1.10, effect 3.22.4, vitest 4.1.12, playwright 1.64.1, eslint 10.13.0, lucide-react 1.61.0); `@types/node` 24.19.2 added.
- §9 manifest -> WXT's auto-added `host_permissions` are removed in production via a `build:manifestGenerated` hook; the test build adds `<all_urls>`.
- `web_accessible_resources` -> `fonts/*` and `assets/*` because WXT bundles fontsource files under `assets/`.
- W0-fix2 -> `src/platform/fake-chrome.ts` excluded from coverage; `test-driver.ts` kept in.

### W1-domain

- §4 checklist 3 -> `NotePatch` uses a flat `label`; `NoteDraft` carries label only inside `target`.
- `normalizePage` keeps the port in host; an invalid URL returns `{host:'', path:input}`.
- `groupByPage` appends notes absent from `order` in input order.
- `InvariantViolation` added as a TaggedError and included in `ErrorTag`.

### W1-design-system

- §10.1 / R-03 -> controls are 28 px (spec density), not 44 px touch targets; desktop side panel.
- §10.1 icons -> Lucide, chosen by relevance (Crosshair, MessageSquare, Pencil, EyeOff, RotateCcw).
- Added an `Input` primitive; no manual theme toggle (follows `prefers-color-scheme`); `Dialog` renders in place with `position: fixed` so it works in a shadow root.
- Shortcut hints -> mono-first font stack with system symbol fallbacks; the JetBrains Mono latin subset lacks the glyphs for the command, option, shift and return symbols (fix3).
- CSS content is checked by reading `tokens.css` and a one-off Vite build, since Vitest does not process CSS.

### W1-copy

- §11.1 / §11.4 title -> "Website review: example.com" with a colon instead of an em dash -> antislop R-02.
- §11.4 screenshot hint -> emoji removed -> humanizer rule.
- Dates formatted in UTC so output is machine-independent.
- fix1 -> Human single-page export gets a `**Page:** <url>` line.
- fix2 -> `meta` accepts `'rest'|'hover'|'focus'` as well as `'before'|'after'`; `panel.states.loading` is a plain string.
- fix3 -> 4 new error tags added to copy; `noResults` and `filterLine` text gained periods.

### W2-markdown

- §11.1 title -> LLM title keeps the em dash byte-for-byte; Human title uses the colon.
- §11.1 -> `TITLE_MAX` is 48; long paths become `host/first/…/last`, then hard-clip; filename slug is host + path with unsafe characters replaced by `-`.
- §11.2 -> date/time use export time in UTC; Locate has no Classes line; attributes order is data-testid, id, aria-label, role, name; "Remove this element." is a bullet.
- §11.2 Verify -> hidden notes read only "is removed"; a force-applied note with no edits reads "the element matches the request above" (neutral constant).
- §11.3 -> edge lines use plain `FV-b` / `FV-a` without backticks, matching the template example, not the prose.
- §11.4 -> Summary section omitted; screen size uses the first note's viewport; why and comment render as two `**Note:**` paragraphs.
- fix1 -> Human `**Page:** <url>` own line; with no `**Note:**` line the `### n.` heading attaches to the next line.
- fix2 -> page-derived text (titles, URLs, context, selector) is escaped/one-lined; user-authored why/comment is not. Human style lines still wrap values in plain single backticks from `src/copy` (values are computed CSS).

### W2-locator

- Card hashed-class regex -> implemented as prefix check OR an anchored alphanumeric-with-digit rule; the unanchored form flags stable classes such as `btn-primary`.
- Selection context comes from `nearestBlock(el)`, not the range ancestor, to avoid context bleeding to body.
- `findElement` returns a match only when unique, else null.
- `autoLabel` falls back to the humanized first stable class, then the tag.

### W2-storage

- §6 -> `replace` on an unknown id dies with `InvariantViolation`.
- `list` returns `{items, corrupt}`; streams emit items only.
- `changes` fails with `StorageUnavailable` when `chrome.storage` is missing.
- `put` fails if the id exists; `replace` overwrites; `remove` and `removeMany` are separate.
- `cascadeDeleteSession` skips corrupt notes (their shots may stay orphaned).
- fix1 -> `SessionStore.allowContentAccess` added; fix2 -> memory layer shares `FaultControl`.

### W2-messaging-platform

- §8 -> void replies travel as `null` and decode to `undefined`.
- Messenger methods take optional `CallOptions {timeoutMs, retries}`; a transport rejection maps to `MessageTimeout{ms:0}` so the retry wakes the worker.
- §8 additions -> `NoteCreate.rect`, `SessionReorder` (fix1); `HandlerContext.senderTabId`, NON_IDEMPOTENT messages never retried, `DownloadFailed`, live reply on defect (fix2).
- Scripting path is `/content-scripts/content.js` (WXT typed path); `Tabs.get` on a missing tab fails with `UnsupportedPage{url:''}`.
- `unsupportedUrl` -> PDF viewer origin and URLs ending in `.pdf`, plus `chrome-untrusted:`, `devtools:`, `about:` and the web store, are rejected.
- Test support (`fake-chrome.ts`, `fixtures.ts`) lives in `src` and is imported across folders.

### W3-background

- §5 F2 -> sender tab is used for capture; fallback to the active tab when absent (fix2 added the real sender tab).
- Capture without edits stores the single shot as `before`; the crop pads 4 CSS px; re-capture on update uses the viewport crop (no rect).
- Replies carry the underlying error tag (e.g. `StorageQuotaExceeded`, `NoteNotFound`, `InvalidOrder`) instead of `NoteSaveError` so the UI can map tag to copy.
- `Permissions.ensureOrigin` is not called by background (the panel path proceeds).
- `SessionCreate` without a name uses the active tab host.
- Origin-change clearing moved to `Tabs.onUpdated` (fix1); re-inject on same-origin reload (fix2).

### W3-content-core

- ArrowUp/Down walk elements through `parentElement`/`firstElementChild` rather than `Target`s.
- Pins are the real `Pin` primitive mounted per note in `.fv-slot`.
- Marker hover only highlights locally (no `Highlight` message) to avoid panel/page feedback loops.
- `MissingReport` is sent whenever notes exist, including an empty id list, so stale flags clear.
- Picker yields to "+ Note" through a document `CustomEvent` (fix1); clicks inside any Figval host are ignored.
- Text selection is armed on the first `PickerStart` and stays armed.

### W3-edit-engine

- `TextEditSession.onInput` is a `Stream<string>`; `EditRegistry` gained `elementOf(noteId)`.
- `DraftEdits` defined here (not upstream); padding axes carry one value applied to both sides.
- `toDiff` drops style changes when hidden; scope `similar` without a selector degrades to `this`.
- Text edits apply only to the root element; similar scope applies style and hidden.
- `contenteditable` is `plaintext-only`.
- Bookkeeping uses module-level WeakMap/Map; fix1 made the store per-document and added `disposeEdits`.

### W3-panel-model

- `activeSession` is derived, not stored; `loaded`, `sessionPageCounts`, `localOrder`, `confirmDeleteSession` added.
- `Loading` PanelState added to avoid a FirstRun flash; one strip at a time (NotActivated wins).
- Only one pending delete at a time; Undo restores a note without an edit made within 400 ms before deleting it.
- Bound-tab mode polls the tab every `boundTabPollMs` (default 1000), later supplemented by `onUpdated` (fix1).
- Reorder persists (fix1); undo pauses and resumes, autosave cancelled on delete (fix3).

### W4-tooltip-ui

- Tooltip uses its own `<figval-root>` host, so a page has two Figval hosts.
- Esc and header close ask once then discard; Cancel discards at once.
- One draft per page, offered only when the target selector matches.
- Font-weight options show copy labels ("400 Regular"); padding uses `ScrubNumber` with "Pad V"/"Pad H" handles (fix1).
- Tabs are a segmented control (spec §10.1 text segments).
- Skills were first skipped (attempt 1), then applied in the fix1 audit.

### W4-panel-ui

- §10.3 -> Detail "Changes" split into property sections after attempt 1 was rejected; Style rows show before and after with a CSS-generated arrow.
- §10.3 meta line shows the toolbar Before/After value.
- Loading view has no visible text; it exposes `role=status aria-busy`.
- Error toasts auto-dismiss after 8 s (no dismiss-label string exists); fix3 pauses on hover/focus.
- Drag reorder works within a page group; keyboard alternative is Alt+Up/Down.
- Delete session from the header menu navigates to Sessions, then requests the confirm dialog.

### W5-integration-e2e

- Clipboard permission is granted context-wide because Chromium rejects granting to `chrome-extension://` origins.
- Selection scenario cancels the picker with Esc first (the picker intercepts "+ Note" while active); scenario 5 uses `about:blank`.
- `src/content/main.ts` edited for wiring only.
- Chromium installed into the Playwright cache; no `package.json` change.

## 8. Open items

BLOCKED: none.

Open MEDIUM/LOW items (not fixed):

Code
- LOW: functions over 50 lines: `makeMessenger` in `src/messaging/messenger.ts`, and several React components (EditTab about 185 lines, App, NoteGroup, Menu, ScrubNumber, ColorRow, TooltipView).
- LOW: edit engine - overlapping "similar" previews can drop another preview's snapshot until repaint.
- LOW: session-storage key builders are duplicated between background, panel and markers.

Copy (round 2, not applied)
- "Markdown downloaded" versus lowercase "markdown" elsewhere.
- "this page" versus "This page" casing.
- Corrupt-record line has no next step.
- Human export says "Text size" while the editor says "Font size" (spec §11.4 wording, left as is).
- Spec-locked and intentionally unchanged: Human "**Note:**" label; session default name "<host> · <Mon D>".

Other
- Human export style lines wrap computed CSS values in plain single backticks from `src/copy`.
- Round-2 MEDIUM fixes shipped without a third review round (protocol maximum of two).
- `p.impl.md` remains in its Prettier-reformatted form (content unchanged).
- Controls are 28 px, not 44 px touch targets (spec density; desktop side panel).
