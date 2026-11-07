## Node Return — W4-panel-ui attempt 1
status: done

### Implemented graph
```ts
main.tsx: Layer.mergeAll(StorageLive, PlatformLive, MessengerLive) as Layer<PanelEnv>
  → createPanelStore(layer, { boundTabId from ?tab= }) → <App store/>   // styles: buildFontFaceCss(p=>p), uiCss, sidePanelCss; pagehide → store.dispose()
App(store)
  usePanelStore → { model, panel, actions } → PanelContext {store, actions, model}
  PanelState.$match(panel)                       // explicit branch per variant
    Loading      → LoadingView (Skeleton rows, role=status aria-busy)
    FirstRun     → Header · Stage[ FirstRunView(unsupported ? message : big Pick CTA) ] · Footer(disabled)
    EmptySession → Header · Toolbar · Stage[ EmptySessionView ] · Footer(disabled)
    Ready        → Header · Toolbar · StripBar(Strip.$match NotActivated|OtherSession) · SearchBar(showSearch; Cmd/Ctrl+F)
                   · Stage[ noResults ? NoResultsView : NoteList ] · Footer
    Detail       → Stage[ Detail: header(← · title · Menu) · AutosaveField comment/why · force-apply · DetailChanges · Edit on page · ShotBlock · Locator · Delete ]
    Sessions     → Stage[ Sessions: rows (activate/rename/delete) · New session · Dialog confirm ]
    Settings     → Stage[ Settings: preset Segmented · screenshots Checkbox · corrupt count ]
  Stage = body + Toasts(shell, view)             // Deleted·Undo, copied/downloaded, clipboard denied → Download, error toasts (auto-dismiss 8 s)
  NoteList(useContainerWidth ≥ 340 → thumbs) → NoteGroup[useMemo ids; window pointer drag + Alt+↑/↓] → NoteRow(LayerRow) → actions.hover/open/deleteNote/toggleSelected
  reorder: NoteGroup → NoteList.flatten → actions.reorder(all visible ids)
  thumbnails/slider: useShotUrl(store.run(ShotStore.get)) → object URL (revoked on cleanup)
  focus: drill-in headings take focus; useFocusReturn records data-focus-key origin → restores on return to list
  keys: ↑/↓ list nav, Enter (native button) open, Delete delete, Esc back (Dialog/Menu stop propagation), Cmd/Ctrl+F search
```

### Files
| path | action | purpose |
| --- | --- | --- |
| src/entrypoints/sidepanel/main.tsx | modified | production layer, `?tab=` binding, style injection, render, dispose on pagehide |
| src/sidepanel/ui/index.ts | modified | barrel: App, sidePanelCss, THUMB_MIN_WIDTH |
| src/sidepanel/ui/App.tsx | created | PanelState switch, focus return, Esc, Cmd/Ctrl+F |
| src/sidepanel/ui/{Header,Menu,Toolbar,StripBar,SearchBar,States}.tsx | created | header + menu, toolbar, strip, search/chips, empty/loading/no-results views |
| src/sidepanel/ui/{NoteList,NoteGroup,NoteRow}.tsx, reorder.ts | created | grouped list, drag + keyboard reorder, rows, pure move/threshold helpers |
| src/sidepanel/ui/{Detail,DetailChanges,ShotBlock,Locator}.tsx | created | detail drill-in |
| src/sidepanel/ui/{Footer,Sessions,Settings,Toasts}.tsx | created | footer, sessions, settings, toasts |
| src/sidepanel/ui/{context.tsx,hooks.ts,styles.ts,panel.css} | created | context, hooks, style entry, panel styles |
| src/sidepanel/ui/{reorder.test.ts,App.test.tsx,test-support.tsx} | created | 38 tests, fake store helper |
| .orch/returns/W4-panel-ui.1.md | created | this return |

### Exports
- App — `({ store: PanelStore }) => JSX` — side panel root.
- sidePanelCss — `string` — panel layout CSS to inject beside `uiCss`.
- THUMB_MIN_WIDTH — `340` — thumbnail threshold.

### Errors handled
| error tag | strategy | where |
| ClipboardDenied (errors.export) | escape → toast + "Download .md instead" | Toasts |
| pick/showNotes tags, PermissionDenied/InjectionFailed flags | escape → helper text + inline alert + Try again | Toolbar, FirstRunView |
| note:<id> (NoteSaveError etc.) | escape → Field error under comment; toast outside Detail | Detail, Toasts |
| session / settings tags | escape → inline alert in Sessions / Settings; toast elsewhere | Sessions, Settings, Toasts |
| any other key (export, copyShot, delete, markers, scroll, edit, storage, beforeAfter) | escape → toast with `copy.errors[tag]`, auto-dismissed via actions.dismissError after 8 s | Toasts |
| ShotStore read failure | escape → "No screenshot" placeholder | useShotUrl |

### Verification
| command | exit | tail |
| --- | --- | --- |
| npx vitest run src/sidepanel/ui | 0 | Test Files 2 passed (2), Tests 38 passed (38) |
| npm run typecheck | 0 | wxt prepare ok, tsc --noEmit clean (tooltip errors seen mid-run were W4-tooltip-ui's and settled) |
| npx eslint src/sidepanel/ui src/entrypoints/sidepanel --max-warnings 0 | 0 | no output |
| npm run build | 0 | Built extension in 778 ms; sidepanel chunk 556.55 kB (Vite size warning only) |

### Coverage
Not measured. Tests cover every PanelState variant, both Strip variants, noResults, unsupported toolbar, permission-declined retry, export-disabled hint, filter scope, keyboard nav/Enter/Delete/Alt+Arrow/Esc/Cmd+F, Undo toast, clipboard-denied toast, session delete Dialog, autosave, focus return, plus pure reorder helpers. Drag-with-pointer and the screenshot slider are not exercised in happy-dom.

### Deviations
- §10.3 Changes: copy has no Fill/Typography/Layout/Visibility titles, so one "Changes" PropertySection holds read-only Text, Style (one row per property, color swatch for color props), hide, and Scope rows.
- §10.3 meta line: `copy.panel.detail.meta` takes `'before'|'after'`, so it shows the toolbar Before/After value, not the target state (`rest|hover|focus`).
- §10.3 Locator: DOM path, selector and HTML render as three mono blocks without sub-labels (no copy strings).
- §10.2 No-results with an empty query uses the active filter chip labels as the quoted text.
- §10.2 Controls follow the 28–32 px density rule in §10.1 (tap targets below 44 px by spec).
- Loading view has no visible text (no copy string); it exposes `role=status aria-busy`.
- Error toasts auto-dismiss after 8 s because no dismiss-label string exists.
- Drag reorder is within a page group; keyboard alternative is Alt+↑/↓ on a row.
- Delete session from the header ⋯ menu navigates to Sessions, then requests the confirm dialog (the model only renders it there).
- Screenshots: no model change needed; thumbnails and slider read blobs via `store.run(ShotStore.get)`.

### Needs
- copy (W1-copy): `panel.states.loading` (Loading label), `panel.detail.locatorParts.{domPath,selector,html}`, `panel.detail.changeGroups.{fill,typography,layout,visibility}`, `toasts.dismiss`, a `panel.states.noResults` variant for filter-only misses, and `panel.detail.meta` taking the target state.
- No package, model or background changes required.
