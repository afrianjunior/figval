# Figval v1 — Implementation Spec

Source of truth for building Figval v1. The coordinator prompt (`p.impl.prompt`) drives the build; every worker node reads the sections of this file named in its node card (§N).

```
User → Website → Figval (Chrome extension) → LLM-ready Markdown
```

Figval lets a person mark an element or a text selection on any website, leave a comment or edit the element live (before/after), and export every note as Markdown for a coding agent (LLM) or for a human reader. It is operated from the Chrome side panel.

---

## 0. Product decisions (locked)

| Topic                          | Decision                                                                                                               |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Users                          | Developers and non-technical reviewers. One tool, two presets: `developer`, `reviewer`                                 |
| Scope of notes                 | Per page and multi-page sessions. Many sessions stored, one active                                                     |
| LLM inside extension           | None in v1. Output is Markdown only                                                                                    |
| Before/After                   | v1: text edit, limited style panel, hide, scope `this` / `similar`                                                     |
| Style panel                    | Limited controls only. Raw CSS is v2                                                                                   |
| CSS variable / token detection | v2. Style diff stores computed values only                                                                             |
| Export                         | `.md` download and copy to clipboard. No `.zip`, no images inside Markdown                                             |
| Formats                        | LLM Markdown and Human Markdown                                                                                        |
| Screenshots                    | Stored locally, shown in side panel, copied per note. Never inside the `.md`                                           |
| HTML snippet in LLM output     | Always included. No toggle                                                                                             |
| Intent                         | Note with edits → `apply`. Comment-only → `propose`, unless the user ticks "Let the agent apply this" (`forceApply`)   |
| IDs                            | `FV-n`, sequential per session, never renumbered                                                                       |
| Activation                     | Per tab, by user gesture (Pick button, keyboard command, toolbar icon). No broad host permission at install            |
| Detail view                    | Drill-in screen, not inline expand                                                                                     |
| Search & filter                | In v1                                                                                                                  |
| Tooltip default tab            | `reviewer` → Comment. `developer` → last used tab                                                                      |
| Why field                      | Hidden behind "+ Add reason"                                                                                           |
| Padding control                | Two sliders: vertical, horizontal                                                                                      |
| Re-capture                     | Editing a saved note's edits re-captures the "after" shot if the element is on the page. "Before" is never re-captured |
| UI language                    | English for v1. All strings live in one copy module so a second locale can be added later                              |

### Out of scope (v2+)

AI polish, raw CSS mode, token detection, moving/reordering elements on the page, image replace, iframes and the site's own Shadow DOM, console/network capture, GitHub/Linear/Jira, sharing sessions, pasting the agent's report back into the side panel, Firefox/Safari.

---

## 1. Stack

| Concern             | Choice                                                                                            | Why                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Extension framework | WXT (latest stable), Manifest V3                                                                  | Side panel, runtime-registered content scripts, Vite build, test mode |
| Language            | TypeScript `strict`, `noUncheckedIndexedAccess`                                                   |                                                                       |
| Effects, errors, DI | `effect` (v3, includes `Schema`)                                                                  | The design method (§3) maps 1:1 onto Effect                           |
| UI                  | React + `@wxt-dev/module-react`                                                                   | Side panel app and Shadow-DOM tooltip                                 |
| Unit tests          | Vitest + `happy-dom`, `@vitest/coverage-v8`                                                       |                                                                       |
| E2E                 | Playwright, Chromium with `--load-extension`                                                      |                                                                       |
| Lint/format         | ESLint (typescript-eslint) + Prettier                                                             |                                                                       |
| Fonts               | Bundled locally via `@fontsource/*`. Max two families (one sans with character, one mono). No CDN | Content scripts cannot rely on page CSP                               |

Pin exact versions in `package.json`. Only node `W0-foundation` and fix nodes explicitly allowed by the coordinator may change `package.json`.

### npm scripts (contract used by every gate)

| Script               | Does                                                            |
| -------------------- | --------------------------------------------------------------- |
| `npm run typecheck`  | `tsc --noEmit`                                                  |
| `npm run lint`       | ESLint, zero warnings allowed                                   |
| `npm test`           | Vitest run (unit + component)                                   |
| `npm run coverage`   | Vitest with coverage thresholds (§11)                           |
| `npm run build`      | Production build to `.output/chrome-mv3`                        |
| `npm run build:test` | Build with test-mode manifest (§9) to `.output/chrome-mv3-test` |
| `npm run e2e`        | `build:test` then Playwright                                    |

---

## 2. Repository layout

```
./                           ← project root = the working directory that holds this file
├─ wxt.config.ts
├─ package.json
├─ src/
│  ├─ entrypoints/
│  │  ├─ background.ts            → background/main.ts
│  │  ├─ content.ts               (registration: 'runtime') → content/main.ts
│  │  └─ sidepanel/{index.html,main.tsx}
│  ├─ domain/        shapes, ids, errors, derive (pure)
│  ├─ locator/       build / find / similar / label (DOM, pure functions)
│  ├─ markdown/      llm, human, verify, exec-graph, title (pure)
│  ├─ storage/       repos over chrome.storage + IndexedDB, memory layers
│  ├─ messaging/     message schemas, RPC client/server
│  ├─ platform/      Effect services wrapping chrome.* (tabs, scripting, permissions, capture, clipboard, clock, ids)
│  ├─ background/    activation, note service, capture pipeline, commands
│  ├─ content/
│  │  ├─ picker/     element picker + text-selection "+ Note"
│  │  ├─ edit/       edit engine (preview, revert, reapply, before/after)
│  │  ├─ markers/    numbered badges + highlight sync
│  │  └─ tooltip/    Shadow-DOM React tooltip
│  ├─ sidepanel/
│  │  ├─ model/      view-model, store, actions (no JSX)
│  │  └─ ui/         React components (tree = content, variants = states)
│  ├─ ui/            shared tokens.css, fonts, primitives (Button, Field, Slider, Swatch, Toast…)
│  └─ copy/          strings.ts — every user-facing string
├─ tests/
│  ├─ fixtures/      static.html, spa.html, hashed-classes.html, long-page.html
│  └─ e2e/
└─ .orch/returns/    worker return files (written by workers)
```

One folder = one owner node (§12). Barrel `index.ts` per folder exports the public API; other folders import only from the barrel.

---

## 3. Design method mapping

Every code node follows **Design Thinking** (`X → Graph → Effect<A, E, R>`), §1–§10. Concretely:

| §              | Rule in this codebase                                                                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §1 Shapes      | All records, IDs, variants, errors defined once in `src/domain` with `Schema` (§4)                                                                       |
| §2 A           | Each flow below (§5) is a call graph. Code is written to match it                                                                                        |
| §3 Cardinality | One-shot = `Effect`. `chrome.storage.onChanged`, tab changes, DOM mutations = `Stream`                                                                   |
| §4 E           | Errors are `Schema.TaggedError` values. Each node handles them as retry / escape / die per §6                                                            |
| §5 R           | Every chrome API lives behind a `Context.Tag` service in `src/platform` or `src/storage`. No direct `chrome.*` calls outside those folders               |
| §6 Boundary    | Decode with `Schema` at: runtime messages, storage reads, DOM-derived drafts, settings. Nowhere else                                                     |
| §7 Behavior    | Retry/timeout/logging are added with `.pipe(...)` — never inside the happy path                                                                          |
| §8 Scope       | Picker mode, tooltip, MutationObservers, event listeners, IndexedDB connections use `Effect.acquireRelease` / `Scope`                                    |
| §9 Test        | Every service has a memory/test layer. Tests swap layers; call graphs stay the same                                                                      |
| §10 Code       | `Effect.gen` body = happy path only. `.pipe()` after it = complete E handling. Divergent strategy inline only when marked with a `// divergent:` comment |

UI nodes additionally follow the UI rules from the design discussion: component tree = content, state variants (empty, loading, partial, error, denied) are named and styled explicitly (§10).

Pure modules (`domain`, `locator`, `markdown`, `edit` core) are plain functions returning values; wrap in Effect only at the service edge.

---

## 4. Shapes (§1)

### IDs (branded)

| ID          | Format                     | Notes                              |
| ----------- | -------------------------- | ---------------------------------- |
| `SessionId` | `fv-` + 4 chars `[a-z0-9]` | Shown in exports and return format |
| `NoteId`    | UUID v4                    | Internal                           |
| `NoteSeq`   | positive int               | Rendered as `FV-{seq}`             |
| `ShotId`    | UUID v4                    | IndexedDB key                      |
| `TabId`     | non-negative int           |                                    |

### Records

```ts
Settings {
  schemaVersion: 1
  preset: 'developer' | 'reviewer'          // default 'reviewer'
  screenshots: boolean                      // default true
  activeSessionId: SessionId | null
  lastTooltipTab: 'comment' | 'edit'        // used by developer preset
}

Session {
  schemaVersion: 1
  id: SessionId
  name: string                              // default "<host> · <Mon D>"
  createdAt: number; updatedAt: number      // epoch ms
  nextSeq: NoteSeq                          // only increases
  noteOrder: NoteId[]                       // user order; new notes appended
}

Note {
  schemaVersion: 1
  id: NoteId; seq: NoteSeq; sessionId: SessionId
  createdAt: number; updatedAt: number
  page:   { url: string; title: string; viewport: { w: number; h: number }; dpr: number }
  target: Target
  comment: string                           // may be ''
  why: string                               // may be ''
  forceApply: boolean
  edits:  Edits
  shots:  { before: ShotId | null; after: ShotId | null }
}

Target {
  kind: 'element' | 'text'
  label: string                             // auto, user-editable
  text: string                              // visible text, trimmed to 200 chars
  attrs: { id?; testid?; ariaLabel?; role?; name? }
  classes: string[]
  domPath: DomStep[]                        // nearest landmark → element, max 6
  selector: string                          // unique CSS selector
  html: string                              // trimmed outerHTML, max 2048 chars
  selection: { text: string; before: string; after: string } | null  // kind=text, ±80 chars context
  state: 'rest' | 'hover' | 'focus'
}

DomStep { tag: string; id?: string; classes: string[]; nth?: number; testid?: string }

Edits {
  text:   { before: string; after: string } | null
  style:  StyleChange[]                     // only changed properties
  hidden: boolean
  scope:  'this' | 'similar'
  similarSelector: string | null
  similarCount: number                      // at creation time
}

StyleChange { property: StyleProperty; before: string; after: string }
StyleProperty = 'color' | 'background-color' | 'font-size' | 'font-weight'
              | 'padding-block' | 'padding-inline' | 'border-radius' | 'text-align'
```

Padding is captured as the original four-side value in `before` (e.g. `8px 16px 12px 16px`) and the resulting value in `after`.

### Derived (never stored) — `src/domain/derive.ts`

| Value                       | Rule                                                                               |
| --------------------------- | ---------------------------------------------------------------------------------- |
| `hasEdits(note)`            | `text != null                                                                      |     | style.length > 0                        |     | hidden` |
| `intent(note)`              | `hasEdits                                                                          |     | forceApply`→`'apply'`, else `'propose'` |
| `tags(note)`                | ordered subset of `text`, `style`, `hide`, `comment` (comment if `comment !== ''`) |
| `normalizePage(url)`        | host without `www.`, path without trailing slash, no query/hash. `/` stays `/`     |
| `groupByPage(notes, order)` | pages ordered by their first note in `noteOrder`; notes inside by `noteOrder`      |
| missing status              | runtime only (content reports it); never persisted                                 |

### Errors (tagged)

| Error                  | Raised by      | Context fields   |
| ---------------------- | -------------- | ---------------- |
| `StorageQuotaExceeded` | storage        | `bytesInUse`     |
| `StorageCorrupt`       | storage decode | `key`, `issue`   |
| `StorageUnavailable`   | storage        | `cause`          |
| `ShotStoreError`       | IndexedDB      | `op`, `cause`    |
| `UnsupportedPage`      | activation     | `url`            |
| `PermissionDenied`     | activation     | `origin`         |
| `InjectionFailed`      | activation     | `tabId`, `cause` |
| `CaptureFailed`        | capture        | `reason`         |
| `ElementNotFound`      | locator find   | `noteId`         |
| `ClipboardDenied`      | export         | `cause`          |
| `MessageTimeout`       | messaging      | `type`, `ms`     |
| `MessageDecodeError`   | messaging      | `type`, `issue`  |
| `InvariantViolation`   | anywhere       | `what` → **die** |

---

## 5. Call graphs (§2, §3)

### Production

```ts
// F1 Activate — one-shot
ToolbarIcon.click | Command("pick") | SidePanel.PickButton
  → Background.Activation.ensure(tabId)
    → Platform.Tabs.get(tabId)                 // reject chrome://, webstore, pdf → UnsupportedPage
    → Platform.Permissions.ensureOrigin        // side-panel path only (§9)
    → Platform.Scripting.injectContent(tabId)  // idempotent: ping first
    → Messaging.toContent(PickerStart)
      → Content.Picker.start                   // scoped: listeners released on stop
```

```ts
// F2 Pick → tooltip → save — one-shot per note
Content.Picker.select(el) | Content.TextSelection.addNote(range)
  → Locator.build(el, range?) : Target
  → Content.Tooltip.open(Target)                // scoped attention
    → Content.Edit.preview(Edits)              // live, reversible
  → Content.Tooltip.save(Draft)
    → Messaging.toBackground(NoteCreate{draft})
      → Background.NoteService.create
        → Schema.decode(NoteDraft)
        → Background.Capture.shots(tabId, rect, hasEdits)
          → Messaging.toContent(UiHide) → Platform.Capture.visibleTab → crop → WebP
          → Messaging.toContent(EditsOff) → capture before → EditsOn → capture after  // when hasEdits
          → Storage.ShotStore.put
        → Storage.SessionRepo.ensureActive       // creates session on first note
        → Storage.NoteRepo.insert(seq = session.nextSeq)
          → chrome.storage.onChanged
            → SidePanel.Model.notesStream        // Stream
              → SidePanel.UI.List
```

```ts
// F3 Edit / delete from side panel — one-shot
SidePanel.UI.Detail.change(field) (debounced 400ms)
  → SidePanel.Model.actions.updateNote
    → Messaging.toBackground(NoteUpdate{id, patch})
      → Background.NoteService.update            // single writer
        → (edits changed && element present) → Capture.after → ShotStore.replace
        → Storage.NoteRepo.replace
SidePanel.UI.Row.delete
  → Model.actions.deleteNote (optimistic hide + Undo toast 5s)
    → on timeout: Messaging.toBackground(NoteDelete) → NoteRepo.remove → ShotStore.remove
```

```ts
// F4 Export — one-shot
SidePanel.UI.Footer.copy | download
  → Model.selectForExport(scope: 'all' | 'page' | 'selected' | 'filtered')
    → Markdown.render(format, { session, notes, now })
      → Domain.derive (intent, tags, groupByPage)
      → Markdown.verifyLine / execGraph / title / filename
    → Platform.Clipboard.writeText | Platform.Download.markdown
```

```ts
// F5 Revisit & sync — Streams
Platform.Tabs.activeChanges                      // Stream
  → SidePanel.Model.currentPage
    → (tab activated) Messaging.toContent(MarkersRender{notes})
      → Content.Markers.render
        → Locator.find(target) per note          // fallback chain
          → Messaging.toBackground(MissingReport{ids})  // runtime only
Content.Edit.reapply  ← MutationObserver Stream  // SPA re-render
SidePanel.Row.hover ↔ Content.Markers.highlight  // both directions
```

```ts
// F6 Copy screenshot — one-shot
SidePanel.UI.Detail.copyShot(which)
  → Storage.ShotStore.get → convert WebP → PNG → Platform.Clipboard.writeImage
```

### Tests (same graphs, swapped R)

```ts
Background.NoteService
  → NoteRepo.layer
    → ChromeStorage.memoryLayer
  → ShotStore.memoryLayer
  → Capture.testLayer          // returns fixed 1×1 WebP
  → Clock.fixedLayer, Ids.sequenceLayer

SidePanel.Model
  → Messaging.loopbackLayer    // routes to in-process Background with memory layers
  → Tabs.testLayer             // active tab driven by test, or ?tab=<id> in e2e

Markdown.render                // pure: fixtures in, golden strings out
```

---

## 6. Break points (§4)

| Where                          | Error                  | Strategy                                                  | User-facing result                                                            |
| ------------------------------ | ---------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Activation                     | `UnsupportedPage`      | escape                                                    | Toolbar replaced by "Figval can't run on this page." List + export still work |
| Activation                     | `PermissionDenied`     | escape                                                    | Inline note under Pick: site access was declined, with a retry button         |
| Activation                     | `InjectionFailed`      | retry ×1 (300 ms), then escape                            | Same as unsupported, plus reload hint                                         |
| Messaging                      | `MessageTimeout`       | retry ×2 (wakes the service worker), then escape          | Error next to the action that failed                                          |
| Messaging                      | `MessageDecodeError`   | die in dev, escape in prod (log + drop)                   | —                                                                             |
| Capture                        | `CaptureFailed`        | escape                                                    | Note saved without shot; detail shows "No screenshot"                         |
| Storage write                  | `StorageQuotaExceeded` | escape                                                    | Tooltip stays open with its content and shows the quota error                 |
| Storage read                   | `StorageCorrupt`       | escape: skip record, keep others, count shown in Settings | —                                                                             |
| Locator find                   | `ElementNotFound`      | escape                                                    | Row shows "not found" badge; note kept                                        |
| Export                         | `ClipboardDenied`      | escape                                                    | Message offering the `.md` download instead                                   |
| Seq duplicate, unknown variant | `InvariantViolation`   | die                                                       | —                                                                             |

E scoping by layer:

```ts
ChromeStorage (StorageUnavailable | quota)  → Repo (StorageQuotaExceeded | StorageCorrupt)
  → NoteService (NoteSaveError{reason})      → Messaging reply {ok:false, error}
    → UI maps error tag → copy key
```

Consumers never see errors from layers deeper than the one they call.

---

## 7. Requirements / services (§5, §9)

| Service (`Context.Tag`)                   | Folder    | Production layer                                         | Test layer                        |
| ----------------------------------------- | --------- | -------------------------------------------------------- | --------------------------------- |
| `ChromeStorage`                           | storage   | `chrome.storage.local`                                   | in-memory map + onChanged emitter |
| `SessionStore` (`chrome.storage.session`) | storage   | session storage                                          | memory                            |
| `NoteRepo`, `SessionRepo`, `SettingsRepo` | storage   | over `ChromeStorage`                                     | same impl over memory             |
| `ShotStore`                               | storage   | IndexedDB `figval-shots`                                 | memory                            |
| `Tabs`                                    | platform  | `chrome.tabs`                                            | test driver                       |
| `Scripting`                               | platform  | `chrome.scripting`                                       | records calls                     |
| `Permissions`                             | platform  | `chrome.permissions`                                     | configurable grant/deny           |
| `Capture`                                 | platform  | `chrome.tabs.captureVisibleTab` + `OffscreenCanvas` crop | fixed image                       |
| `Clipboard`                               | platform  | `navigator.clipboard`                                    | records writes                    |
| `Download`                                | platform  | `chrome.downloads` or anchor download                    | records                           |
| `Clock`, `Ids`                            | platform  | `Date.now`, `crypto.randomUUID`                          | fixed / sequence                  |
| `Messenger`                               | messaging | `chrome.runtime` / `chrome.tabs.sendMessage`             | loopback                          |

Storage keys: `settings`, `sessions` (array of Session), `notes:<SessionId>` (array of Note). Deleting a session deletes its notes key and all its shots.

Background is the **single writer** for sessions and notes (avoids `nextSeq` races). Side panel and content send commands; everyone reads via `ChromeStorage` + `onChanged`.

---

## 8. Boundaries (§6)

Decode with `Schema` at exactly these edges:

1. Every runtime message, both directions. Messages are a tagged union in `src/messaging/protocol.ts`:
   `PickerStart`, `PickerStop`, `Ping`, `UiHide`, `UiShow`, `EditsOff`, `EditsOn`, `MarkersRender`, `MarkersClear`, `Highlight`, `ScrollTo`, `TooltipReopen{noteId}`, `NoteCreate`, `NoteUpdate`, `NoteDelete`, `SessionCreate`, `SessionRename`, `SessionDelete`, `SessionActivate`, `SettingsUpdate`, `MissingReport`, `ActivateTab`. Each request has a matching reply `{ ok: true, value } | { ok: false, error }`.
2. Every storage read (with `schemaVersion` migration hook; v1 has none).
3. The draft built from the DOM in content before sending (`NoteDraft`).

Inside the boundary, code trusts the types.

---

## 9. Activation and permissions

Manifest permissions: `sidePanel`, `activeTab`, `scripting`, `storage`, `unlimitedStorage`, `downloads`. `optional_host_permissions: ["<all_urls>"]`. No `host_permissions`.

- **Toolbar icon click** and **keyboard command** `pick` (`Alt+Shift+F`) grant `activeTab` → inject content → start picker. Toolbar icon also opens the side panel (`sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`); the command `_execute_action` is not used.
- **Side panel Pick button**: a click inside the side panel may not grant `activeTab`. Call `chrome.permissions.request({ origins: [origin + '/*'] })` from the click handler (user gesture), then inject. Chrome shows its own one-time prompt per site. If already granted, no prompt.
- Content script is registered with `registration: 'runtime'` and injected via `chrome.scripting.executeScript({ files: [...] })`. Injection is idempotent: `Ping` first.
- Per-tab activation state lives in `chrome.storage.session` keyed by tabId; cleared on `tabs.onUpdated(status: 'loading')` with a different origin, and on tab close.
- When the current page has notes but Figval is not active on the tab, the side panel shows "3 notes on this page · Show". Clicking it runs the side-panel activation path, then renders markers.
- Text selection "+ Note" works only after activation on that tab.
- Unsupported: `chrome://*`, `chrome-extension://*`, `https://chromewebstore.google.com/*`, `view-source:`, the built-in PDF viewer.
- **Test mode** (`npm run build:test`): manifest adds `host_permissions: ["<all_urls>"]` and the side panel accepts `?tab=<id>` to bind to a tab. This is the swapped R for e2e; production code paths are unchanged.

---

## 10. UI spec

### 10.1 Visual direction

Direction: **Figma-like design tool UI.** Figval should feel like a property panel and comment layer from a professional design tool: dense, quiet, precise, built for people who inspect and tweak. Must also pass the antislop UI skill; no default Tailwind/shadcn look, no gradient blobs.

**Figma-like rules (apply to side panel, tooltip, picker, markers):**

| Area               | Rule                                                                                                                                                                                                                                                                          |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Density            | Compact UI type (11–12 px body, 13 px section titles), 28–32 px control height, tight 4/8 px spacing grid. Hierarchy comes from weight and muted color, not big type                                                                                                          |
| Surfaces           | Neutral gray surfaces, 1 px hairline dividers between sections, floating panels with medium radius (~12 px) and one soft shadow. Controls use small radius (~5 px). Light and dark both first-class                                                                           |
| Accent             | One selection blue (own token value) for selection outlines, focus rings, active tab, primary button. Other semantic roles (`--c-propose`, `--c-missing`) stay muted and small                                                                                                |
| Property panel     | Tooltip Edit tab and Detail "Changes" are property sections with uppercase-free small titles: **Text**, **Fill**, **Typography**, **Layout**, **Visibility**. Label-left / value-right rows; a section header shows a reset action when it has changes                        |
| Number inputs      | Scrubbable: drag horizontally on the field's label/icon to change the value (Shift = ×10), arrow keys ±1, typed values accepted. Used for font size, padding vertical/horizontal, radius. The two padding sliders from §0 may render as scrub fields with a slider affordance |
| Color              | Swatch + hex field row, like a fill row in a design tool; clicking the swatch opens a compact picker with page swatches on top                                                                                                                                                |
| Segmented controls | Icon segments (align left/center/right; Comment/Edit tabs as text segments)                                                                                                                                                                                                   |
| Picker             | Hover = thin selection-blue outline; selected = 1.5 px outline + small corner squares + a label chip above the element showing `tag.class` and `W × H`                                                                                                                        |
| Markers            | Comment pins: round-cornered speech-bubble pins with the `FV-n` number, anchored at the element's top-right; hover enlarges slightly and shows the comment preview                                                                                                            |
| Tooltip            | Reads as a comment composer (Comment tab) attached to a pin, with the property panel (Edit tab) below it                                                                                                                                                                      |
| Lists              | Side panel rows behave like a layers list: 28–32 px rows, hover wash, selected wash, drag handle on hover, secondary info muted on the right                                                                                                                                  |
| Shortcuts          | Show keyboard hints in tooltips/menus in muted mono (e.g. `⌘↵`, `Esc`, `⌥⇧F`)                                                                                                                                                                                                 |
| Icons              | One consistent 16 px outline icon set (e.g. Lucide), 1.5 px stroke                                                                                                                                                                                                            |

**Not allowed:** Figma's logo, name, proprietary icons, screenshots, or any branding. "Figma-like" means the interaction and density patterns, built with Figval's own tokens.

Semantic color roles (tokens in `src/ui/tokens.css`, light + dark via `prefers-color-scheme`):

| Role                          | Used for                                                  |
| ----------------------------- | --------------------------------------------------------- |
| `--c-apply`                   | `apply` intent badge, primary action                      |
| `--c-propose`                 | `propose` intent badge                                    |
| `--c-missing`                 | "not found" badge, destructive actions                    |
| `--c-changed`                 | changed-property dot in the style panel, picker highlight |
| surface / text / muted / line | layout                                                    |

Fonts: bundled. For the Figma-like density, a neutral UI sans built for small sizes (Inter is acceptable here for that reason) paired with one mono for IDs, selectors and values. Tooltip runs in a page's Shadow DOM, where `@font-face` inside the shadow root is ignored — inject one document-level `<style>` with `@font-face` pointing at `chrome.runtime.getURL(...)` (declare fonts in `web_accessible_resources`). Tooltip CSS must fully reset inherited styles (`all: initial` on host).

Motion: transform/opacity only; `prefers-reduced-motion` replaces motion with a static color change.

### 10.2 Side panel surfaces

Width 320–600 px (user-resizable). One main surface plus drill-ins.

```
┌────────────────────────────────┐
│ Landing revamp (7) ▾        ⋯  │  header: session switcher + menu
├────────────────────────────────┤
│ [◎ Pick element]  Before|After │  toolbar
│  or select text on the page    │
├────────────────────────────────┤
│ [ Search notes…            ]   │  shown when ≥5 notes
│ text style hide comment │ apply propose │ not found
├────────────────────────────────┤
│ ● /register · this page      3 │  current page group, always open
│  FV-5  Sign-up button    [img] │
│  text·style                    │
│  "Too loud, match /pricing…"   │
│  FV-6  Email label     propose │
│  FV-7  Promo banner  not found │
│ ▸ /         · Home           2 │  other groups, collapsible
├────────────────────────────────┤
│ LLM | Human      All pages ▾   │  footer, sticky
│ [   Copy markdown   ] [↓ .md]  │
└────────────────────────────────┘
```

| Surface             | Contents                                                                                                                                                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header              | Session switcher (name + count), ⋯ menu: Settings, Rename, Delete session                                                                                                                          |
| Toolbar             | Pick button, Before/After toggle, helper text that depends on activation state                                                                                                                     |
| Search + filter     | Text search over `FV-n`, label, comment, why, target text, page path. Chips: type (`text` `style` `hide` `comment`), intent (`apply` `propose`), status (`not found`). `Cmd/Ctrl+F` focuses search |
| List                | Grouped by page; current page first and always open; others collapsible. Rows draggable to reorder (`noteOrder`)                                                                                   |
| Row                 | `FV-n`, label (1 line), tags, comment (1 line), intent badge when `propose`, `not found` badge, thumbnail when width ≥ 340 px, checkbox in "selected" export scope                                 |
| Detail (drill-in)   | See 10.3                                                                                                                                                                                           |
| Footer              | Format toggle LLM/Human; scope: All pages / This page / Selected (N) / Filter results (N, only when a filter is active); Copy (primary), Download `.md`                                            |
| Sessions (drill-in) | List sorted by `updatedAt`, rename, delete (confirm dialog), New session                                                                                                                           |
| Settings (drill-in) | Preset, Screenshots on/off, corrupt-record count if any                                                                                                                                            |

**States (all designed):**

| State                    | When                                  | Shows                                                                        |
| ------------------------ | ------------------------------------- | ---------------------------------------------------------------------------- |
| First run                | No session                            | One sentence + large Pick button. Session is created on the first saved note |
| Empty session            | Session with 0 notes                  | Same sentence; export disabled                                               |
| Empty current page       | Notes elsewhere only                  | One muted line in the current group                                          |
| Unsupported page         | §9 list                               | Toolbar replaced by message; list and export work                            |
| Not activated            | Notes on page, Figval inactive        | Strip "3 notes on this page · Show"                                          |
| Notes in another session | Page has notes in an inactive session | Strip "3 notes in 'Landing revamp' · Open"                                   |
| Not found                | Element missing                       | Row badge; detail explains                                                   |
| No search results        | Filter matches nothing                | "No notes match 'xyz'" + Reset filters                                       |
| Storage error            | Write failed                          | Message next to the failed action; nothing is lost                           |
| Export nothing selected  | Scope "Selected", none checked        | Copy disabled + hint                                                         |

**Behavior:** row hover ↔ element highlight (both directions); row click → scroll to element + pulse; panel follows the active tab; keyboard `↑/↓` list nav, `Enter` open detail, `Delete` delete, `Esc` back. Delete note = immediate + "Deleted · Undo" toast for 5 s. Delete session = confirm dialog (screenshots are lost permanently). Focus returns to the origin of every drill-in/overlay.

### 10.3 Detail (drill-in)

```
← FV-5 · Sign-up button          ⋯
/register · 1440×900 · rest
Comment  [textarea]
Why      [textarea]          (shown if non-empty or after "+ Add reason")
☐ Let the agent apply this   (only when no edits)
Changes
  Text   "Daftar…" → "Mulai gratis"
  Style  background-color  #FF2D55 → #0F62FE
  Scope  all similar (4)
  [Edit on page]
Screenshot  [before | after slider]  [Copy before] [Copy after]
Locator ▸   (DOM path, selector, HTML) — open by default in developer preset
[Delete note]
```

Autosave with 400 ms debounce, no Save button. "Edit on page" sends `TooltipReopen` and focuses the page.

### 10.4 Tooltip (content, Shadow DOM)

Width ~320 px. Header: `FV-n` (next seq, provisional) + editable label + close.

- **Comment tab:** textarea (autofocus), "+ Add reason", "Let the agent apply this" checkbox (hidden once any edit exists), Cancel / Save (`⌘/Ctrl+Enter`).
- **Edit tab:** text edit happens on the page (element becomes `contenteditable` with dashed outline; tooltip shows the before → after summary). Controls with current computed values as defaults: text color, background (both with swatches of colors used on the page), font size (stepper, px), font weight (select), padding vertical + horizontal (two sliders), radius (slider), text align (segmented). Changed controls show a dot and a per-control reset. "Hide this element" disables the other style controls. Scope: "Only this" / "All similar (N)" — hovering "All similar" highlights matches. "Reset all".
- **Text-selection variant:** selected text quoted on top (1 line). Edit tab targets the nearest block container and says so ("Editing: p.plan-desc").
- **Position:** beside the element (right → left → below → above), never covering it; if the element is near viewport size, dock bottom-right. Follows scroll; when the element is off-screen show "↑ element above". Draggable by header.
- **Attention:** Save → close, edits stay visible, side-panel row flashes. Cancel → revert all previews. `Esc` empty → close; `Esc` dirty → inline "Press Esc again to discard". Clicking outside does **not** close. Tab switch / reload → draft kept in `chrome.storage.session`; on return "Resume draft FV-8?".
- **States:** Save disabled until comment or at least one edit; non-text element → text row says it has no editable text; element re-rendered → "Element changed, edits re-applied"; element gone → draft can still be saved as a comment; save failure → message above Save, content kept.

### 10.5 Picker

Overlay highlight + small label (tag + main class, `W × H`) on hover, styled per the Figma-like picker rule (§10.1); click selects; `Esc` cancels; `↑`/`↓` move to parent/child. Picker never intercepts clicks while inactive. Text selection shows a small "+ Note" button near the selection end.

---

## 11. Markdown output (exact templates)

All renderers are pure: `(input: ExportInput) => string`. Golden tests compare against fixtures built from these templates.

### 11.1 Title and filename

| Export content       | Title                                  | Filename                                    |
| -------------------- | -------------------------------------- | ------------------------------------------- |
| One page             | `Figval Review — example.com/register` | `figval-example.com-register-2026-11-07.md` |
| Many pages, one host | `Figval Review — example.com`          | `figval-example.com-2026-11-07.md`          |
| Many hosts           | `Figval Review — 2 sites`              | `figval-2-sites-2026-11-07.md`              |

Drop `www.`, query, hash. Truncate long paths in titles with `…` (keep first and last segment); full URL appears in the page section. Human title uses `Website review — …`.

### 11.2 LLM template

Page headings are always present (consistent structure). `Execution graph` appears only when at least one dependency edge exists. Notes without screenshots are fine; screenshots are never referenced.

````markdown
# Figval Review — example.com

> Figval · session `fv-7k2q` · 2026-11-07 14:32 · 4 changes · 2 pages

## Instructions

You are maintaining this website's codebase. Each `FV-n` below is one task node.

**Locate** — try in order; move to the next only if the previous fails:
visible text → `data-testid` / `id` / `aria-label` → class names → DOM path → selector.
DOM paths come from the rendered page and may not match source structure.

**Apply**

- Style values are computed (px, hex). Map to existing tokens, CSS variables, or utility classes when an equivalent exists.
- Apply style changes to the component's variant definitions so hover, focus, active and disabled stay coherent. No one-off inline overrides.
- `scope: this element` → change only this instance. `scope: all similar` → change the shared component.
- `intent: propose` → do not implement; reply with a proposed change.

**When it breaks**

- String not found in code (likely i18n/CMS) or no matching token → `skipped`, give the reason. Do not hardcode.
- Element cannot be located, or two tasks conflict → `needs-clarification`. Do not guess.

**Boundaries**

- Change nothing beyond the listed tasks. Respect the execution order below.

## Execution graph

```
wave1[FV-1 ∥ FV-2 ∥ FV-3] → wave2[FV-4]
```

FV-4 depends on FV-1: both touch `a.btn-primary`; FV-4 overrides FV-1 for one instance.

---

## Page: `/` — Home · viewport 1440×900

URL: https://example.com/

### FV-1 · Hero CTA button

`text` `style` · scope: **all similar** (4 found) · intent: **apply** · state: rest

**Why:** Too loud, match the button style on /pricing

**Locate**

- Text: "Daftar Sekarang Juga!!"
- Attributes: `data-testid="hero-cta"`
- DOM path:
  ```
  main
    → section.hero
      → div.hero__inner
        → a.btn-primary
  ```
- Selector: `section.hero > div > a.btn-primary`

**Change**

- Text: `Daftar Sekarang Juga!!` → `Mulai gratis`

| Property         | Before    | After     |
| ---------------- | --------- | --------- |
| background-color | `#FF2D55` | `#0F62FE` |
| font-size        | `20px`    | `16px`    |
| padding-block    | `20px`    | `12px`    |
| padding-inline   | `48px`    | `24px`    |
| border-radius    | `0px`     | `8px`     |

**Verify:** On `/`, the element reads "Mulai gratis" with background-color `#0F62FE`, font-size `16px`, padding-block `12px`, padding-inline `24px`, border-radius `8px`; all 4 matching elements updated; hover/focus states still distinct.

**HTML**

```html
<a class="btn-primary hero__cta" data-testid="hero-cta" href="/signup">Daftar Sekarang Juga!!</a>
```

---

## Return format

When done, reply with exactly this structure:

```
## Figval Report — session fv-7k2q

| ID | Status | Files | Note |
|----|--------|-------|------|
| FV-1 | done | src/components/Button.tsx | mapped to variant="primary" |

### Located components
FV-1:
  HomePage
    → HeroSection
      → Button (variant=primary)
```

Status: `done` · `skipped` · `needs-clarification` · `proposed`
````

Field rules:

- **Why** line: `why` if non-empty; else `comment` if the note has edits; omitted otherwise. If both `why` and `comment` exist and edits exist, render `**Why:** {why}` and `**Comment:** {comment}`. Comment-only notes render `**Comment:**`.
- **Locate:** include only present fields. Text-selection notes add `Selected text:` and `Context: "…{before}**{text}**{after}…"`.
- **Change:** `Text:` line when text edit; style table when style changes; `Remove this element.` when hidden. Comment-only notes omit Change.
- **Verify** (deterministic): apply → "On `{path}`, the element " + clauses (`reads "{after}"`, `with {prop} \`{after}\``joined by commas,`is removed`) + scope clause (`; all {N} matching elements updated`for similar) +`; hover/focus states still distinct` when style changed. Propose → "Reply with a proposed change for this element; do not edit code."
- Header line tags use `tags(note)`; `scope: **this element**` / `**all similar** (N found)`; `intent: **apply**|**propose**`; `state: {state}`.

### 11.3 Execution-graph heuristic (keep shallow)

Edge `A → B` (A first) when both notes are on the same normalized page, both are `apply`, and either: (a) `A.target.selector === B.target.selector`, or (b) `A.edits.scope === 'similar'` and every class token in `A.edits.similarSelector` is in `B.target.classes`. Waves = topological levels; nodes in a wave sorted by seq. Cycles cannot occur by construction (ties broken by seq); if one appears → `InvariantViolation`. Edge explanation line per dependent node: "`FV-b` depends on `FV-a`: both touch `{selector}`; `FV-b` overrides `FV-a` for one instance." (variant (a): "both edit the same element").

### 11.4 Human template

English, readable, technical detail inside `<details>`. Page heading hidden when the export has one page (URL moves to the meta line).

````markdown
# Website review — example.com

**Date:** 7 November 2026 · **Notes:** 3 · **Pages:** 2
**Screen size during review:** 1440×900

## Summary

- 1 text change
- 1 style change
- 1 element removed
- 1 comment

---

## Home (`/`)

### 1. Hero CTA button

**Note:** Too loud, match the button style on /pricing

**Changes:**

- Text changed from "Daftar Sekarang Juga!!" to **"Mulai gratis"**
- Background color from `#FF2D55` to `#0F62FE`
- Text size from 20px to 16px
- Vertical padding from 20px to 12px, horizontal from 48px to 24px
- Corner radius from 0px to 8px
- Applies to **all similar elements** (4)

📎 _Screenshot available in Figval: FV-1_

<details>
<summary>Technical details</summary>

- ID: FV-1
- Selector: `section.hero > div > a.btn-primary`
- `data-testid="hero-cta"`

```html
<a class="btn-primary hero__cta" data-testid="hero-cta" href="/signup">Daftar Sekarang Juga!!</a>
```

</details>
````

Numbering in the Human output is `1..n` in export order; the FV ID is inside details and the screenshot hint. Screenshot hint only when the note has a shot. Summary counts by tag; omit zero lines. Human-facing phrasing in renderers is subject to the copy rules (§12 W1-copy).

---

## 12. Execution graph (orchestration)

```ts
W0[foundation]
  → G0
    → W1[domain ∥ design-system ∥ copy]
      → G1
        → W2[markdown ∥ locator ∥ storage ∥ messaging-platform]
          → G2
            → W3[background ∥ content-core ∥ edit-engine ∥ panel-model]
              → G3
                → W4[tooltip-ui ∥ panel-ui]
                  → G4
                    → W5[integration-e2e]
                      → G5
                        → W6[review-code ∥ review-copy ∥ review-ui]   // read-only
                          → G6 (findings → fix wave, max 2 rounds)
                            → W7[report]
```

Every node: model `sonnet`, retryable (idempotent: it owns its files, re-running overwrites them), returns the structure in `p.impl.prompt` §Return. Workers never touch files outside their ownership. New dependencies are requested in the return under **Needs**; the coordinator spawns a deps fix node.

Skill sets referenced by cards:

- **COPY** = invoke Skill `humanizer`, then `antislop`, then `antislop-copywriting`. Fallback: read `~/.claude/skills/<name>/SKILL.md`.
- **UI** = invoke Skill `antislop`, then `antislop-ui`, `antislop-human` (contrast, keyboard, focus), `antislop-layoutmobile` (narrow panel reflow). Same fallback.

### Node cards

#### W0-foundation

- **Why:** every other node needs a building, testing project with the folder contract.
- **Owns:** root configs, `package.json`, lockfile, `wxt.config.ts`, `tsconfig.json`, ESLint/Prettier/Vitest/Playwright configs, `src/entrypoints/*` stubs, empty barrels in every `src/*` folder, `tests/fixtures/*.html`, `.gitignore`.
- **Subgraph:** scaffold WXT + React + TS strict + `effect`; manifest per §9 (incl. test-mode variant, `web_accessible_resources` for fonts); side panel entry; runtime content script entry; command `pick`; scripts per §1; fixtures: `static.html` (landmarks, testids, repeated `.btn-primary` ×4, promo banner, pricing cards), `spa.html` (re-renders a list every 2 s and on button click), `hashed-classes.html` (class names like `css-1x2y3z`), `long-page.html` (element below the fold). `git init` and an initial commit (local only, never push).
- **Spec:** §1, §2, §9.
- **Verify:** `npm run typecheck && npm run lint && npm test && npm run build && npm run build:test` all exit 0 (placeholder test allowed).

#### W1-domain

- **Why:** shapes are the nouns every graph moves; one definition prevents drift.
- **Owns:** `src/domain/**`.
- **Subgraph:** branded IDs, records, `StyleProperty`, tagged errors, `NoteDraft` schema, derive functions (§4), id generators (pure given RNG).
- **Spec:** §3, §4, §6.
- **Verify:** `npm run typecheck && npx vitest run src/domain --coverage` (≥ 90% lines).

#### W1-design-system — UI skills

- **Why:** panel and tooltip must share one visual language and pass antislop UI.
- **Owns:** `src/ui/**` (tokens.css, fonts, icons, primitives: Button, IconButton, Field, Textarea, Checkbox, Segmented, Slider, ScrubNumber, ColorRow, PropertySection, PropertyRow, LayerRow, Pin, Select, Swatch, Badge, Chip, Kbd, Toast, Dialog, Skeleton), a dev-only gallery entry if useful.
- **Subgraph:** tokens per §10.1 (light/dark) following the Figma-like rules table; compact type scale, 4/8 px rhythm, focus rings, hover/active/disabled states, reduced motion; ScrubNumber with drag-to-scrub, Shift ×10, arrow keys; primitives presentational only, strings passed in as props.
- **Spec:** §10.1, §10.2–10.4 (for which primitives are needed).
- **Verify:** `npm run typecheck && npx vitest run src/ui` (render + a11y role tests).

#### W1-copy — COPY skills

- **Why:** all wording must read like a person wrote it; one module lets reviewers audit everything at once.
- **Owns:** `src/copy/**`.
- **Subgraph:** `strings.ts` exporting a typed, nested object keyed by surface (`panel.header`, `panel.toolbar`, `panel.states.*`, `panel.detail`, `panel.footer`, `panel.sessions`, `panel.settings`, `tooltip.*`, `picker.*`, `errors.<ErrorTag>`, `toasts.*`, `markdownHuman.*`). Functions for plurals/counts. Cover every string implied by §10 and the Human renderer phrasing in §11.4.
- **Spec:** §10, §11.4, §6 (user-facing results).
- **Verify:** `npm run typecheck`; return includes a before/after list of any phrasing changed from the spec by the skills.

#### W2-markdown

- **Why:** the export is the product; it must match the templates byte for byte.
- **Owns:** `src/markdown/**`, `src/markdown/__fixtures__/**`.
- **Subgraph:** `renderLlm`, `renderHuman`, `verifyLine`, `execGraph`, `exportTitle`, `exportFilename`; TDD with golden fixtures for: single page, multi page, multi host, text-selection comment, propose vs forceApply, hidden, similar scope with dependency, no dependency (graph omitted). Human phrasing from `src/copy`.
- **Spec:** §4 (derive), §11.
- **Verify:** `npx vitest run src/markdown --coverage` (≥ 90%), `npm run typecheck`.

#### W2-locator

- **Why:** agents find code through these hints; the side panel finds elements again through them.
- **Owns:** `src/locator/**`.
- **Subgraph:** `buildTarget(el, range?)`, `findElement(target, doc)` (fallback chain: testid → id → selector → text+tag → domPath), `findSimilar(el)` → `{ selector, count }` (same tag + shared stable classes; skip hashed classes matching `/^(css|sc|jsx|emotion)-|[a-z0-9]{6,}$/`), `autoLabel(el)`, `trimHtml`, `uniqueSelector`.
- **Spec:** §4 Target, §10.5.
- **Verify:** `npx vitest run src/locator --coverage` (≥ 85%) on happy-dom fixtures incl. hashed classes.

#### W2-storage

- **Why:** sessions and notes must survive restarts; tests need swappable storage.
- **Owns:** `src/storage/**`.
- **Subgraph:** services per §7 with production and memory layers; `onChanged` as `Stream`; decode on read; quota mapping; IndexedDB ShotStore with scoped connection; cascade delete session → notes → shots.
- **Spec:** §4, §6, §7, §8.
- **Verify:** `npx vitest run src/storage --coverage` (≥ 85%) using memory layers + `fake-indexeddb` (request in Needs if absent).

#### W2-messaging-platform

- **Why:** three contexts talk only through typed messages; chrome APIs must be swappable.
- **Owns:** `src/messaging/**`, `src/platform/**`.
- **Subgraph:** protocol union + replies (§8), `Messenger` service (request/response with timeout + retry pipe), loopback layer; platform services and test layers (§7). Capture includes crop by rect × dpr and WebP encode via `OffscreenCanvas`; Clipboard includes WebP→PNG for images.
- **Spec:** §5, §6, §7, §8, §9.
- **Verify:** `npx vitest run src/messaging src/platform --coverage` (≥ 80%).

#### W3-background

- **Owns:** `src/background/**`, `src/entrypoints/background.ts`.
- **Why:** single writer and the only context with capture and scripting.
- **Subgraph:** F1 activation, NoteService (create/update/delete, seq, session ensure), capture pipeline incl. before/after toggling and re-capture on edit change, session/settings handlers, side-panel behavior, command handler, activation state in session storage.
- **Spec:** §5 F1–F3, §6, §7, §9.
- **Verify:** `npx vitest run src/background --coverage` (≥ 80%) with memory/test layers.

#### W3-content-core

- **Owns:** `src/content/picker/**`, `src/content/markers/**`, `src/content/main.ts`, `src/entrypoints/content.ts`.
- **Why:** marking is the first move of every note.
- **Subgraph:** picker (scoped listeners, overlay in Shadow DOM, parent/child keys), text selection "+ Note", markers + missing report, highlight/scroll handlers, message router for content-side messages, UI hide/show for capture. Opens the tooltip through an interface exported by `src/content/tooltip` (stub contract: `openTooltip(target, opts): Effect<void>`), implemented in W4.
- **Spec:** §5 F1, F2, F5, §10.5, §8.
- **Verify:** `npx vitest run src/content/picker src/content/markers` (happy-dom), `npm run typecheck`.

#### W3-edit-engine

- **Owns:** `src/content/edit/**`.
- **Why:** before/after is the differentiator; edits must be reversible and survive re-renders.
- **Subgraph:** `computeBaseline(el)`, `preview(el, edits, scope)`, `revert`, `toDiff(baseline, current) → Edits` (only changed props; padding four-side before), `editsOff/editsOn` for capture and the panel toggle, contenteditable session (scoped), MutationObserver reapply (Stream, scoped), page color swatch extraction.
- **Spec:** §4 Edits, §10.4 Edit tab, §5 F5.
- **Verify:** `npx vitest run src/content/edit --coverage` (≥ 85%).

#### W3-panel-model

- **Owns:** `src/sidepanel/model/**`.
- **Why:** keep the panel UI pure; state, streams and actions live here.
- **Subgraph:** `ManagedRuntime` from layers; store via `SubscriptionRef` exposed to React with `useSyncExternalStore`; streams: settings, sessions, notes of active session, active tab, activation state, missing ids; view-model: groups, current page, search/filter, export selection/scope, derived counts, all §10.2 states as a tagged `PanelState`; actions: pick, activate, CRUD via messages, optimistic delete + undo timer (scoped), export copy/download, copy screenshot.
- **Spec:** §5 F3–F6, §7, §10.2.
- **Verify:** `npx vitest run src/sidepanel/model --coverage` (≥ 85%) with loopback + test layers.

#### W4-tooltip-ui — UI + COPY skills

- **Owns:** `src/content/tooltip/**`.
- **Why:** the most touched surface; it must stay light despite holding comment, why, edit and scope.
- **Subgraph:** implement `openTooltip` contract from W3-content-core; Shadow DOM React root, document-level font injection, tabs, edit controls bound to W3-edit-engine, positioning, drag, Esc logic, draft persistence, all §10.4 states. Strings only from `src/copy`; primitives from `src/ui`.
- **Spec:** §10.1, §10.4.
- **Verify:** `npx vitest run src/content/tooltip` (component tests for tabs, Save disabled rule, Esc double-press, checkbox visibility), `npm run typecheck`.

#### W4-panel-ui — UI + COPY skills

- **Owns:** `src/sidepanel/ui/**`, `src/entrypoints/sidepanel/**`.
- **Why:** the home of the product; every void state must be designed.
- **Subgraph:** header, toolbar, search/filter, grouped list with drag reorder, rows, detail drill-in, footer, sessions, settings, toasts, dialog, keyboard map, width-responsive rules (thumbnail ≥ 340 px). Renders `PanelState` variants explicitly. Strings only from `src/copy`.
- **Spec:** §10.1–10.3.
- **Verify:** `npx vitest run src/sidepanel/ui` (one test per `PanelState` variant), `npm run typecheck`.

#### W5-integration-e2e

- **Owns:** `tests/e2e/**`, `playwright.config.ts`; may make wiring-only edits in `src/entrypoints/**` and barrels (listed in return).
- **Why:** prove the graphs end to end in a real Chromium.
- **Subgraph:** e2e on fixtures with the test build: (1) pick → comment → save → row appears → copy LLM → clipboard equals expected structure; (2) edit text + style + similar scope → before/after toggle → export contains style table + exec graph; (3) text selection note; (4) SPA re-render keeps edits and markers; (5) unsupported page state; (6) delete + undo; (7) multi-session switch; (8) screenshots at panel widths 320/360/420 and tooltip on `static.html`, light and dark, saved to `tests/e2e/__screenshots__/`.
- **Spec:** §5, §9, §10, §11.
- **Verify:** `npm run e2e` exit 0.

#### W6-review-code (read-only)

- **Why:** catch defects and graph mismatches before handoff.
- **Subgraph:** review all `src/**` against §3 rules (no `chrome.*` outside platform/storage, gen = A / pipe = E, schemas only at §8 edges, scoped resources), user coding rules (immutability, functions < 50 lines, files < 800 lines, no `console.log`), security (no `innerHTML` with page data, message sender checks). Output findings with file:line, severity (CRITICAL/HIGH/MEDIUM/LOW), owner folder.

#### W6-review-copy (read-only) — COPY skills

- **Subgraph:** audit `src/copy/**` and Human renderer output fixtures; findings as exact before → after replacements.

#### W6-review-ui (read-only) — UI skills

- **Subgraph:** audit `src/ui`, `src/sidepanel/ui`, `src/content/tooltip`, `src/content/picker`, `src/content/markers` and the e2e screenshots: every row of the §10.1 Figma-like rules table (and no Figma branding), antislop UI checklist, contrast (both themes), keyboard path, focus return, reduced motion, narrow-width reflow. Findings with owner folder and concrete fix.

#### W7-report

- **Owns:** `REPORT.md`.
- **Subgraph:** summarize final graph vs spec, node attempts, gates, open BLOCKED items, deviations, how to load the extension (`.output/chrome-mv3` → chrome://extensions → Load unpacked), test commands and coverage numbers. Content supplied by the coordinator in the prompt.

---

## 13. Done (v1)

- All gates green: `typecheck`, `lint`, `test`, `coverage` thresholds, `build`, `e2e`.
- Every §10 state reachable and styled; every §6 error mapped to a copy key.
- LLM and Human outputs match §11 goldens.
- Review findings: no CRITICAL/HIGH open.
- `REPORT.md` written.
