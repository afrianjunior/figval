## Node Return — W4-panel-ui-fix1 attempt 2
status: done

### Implemented graph
```ts
DetailChanges(edits) → ORDER[text, fill, typography, layout, visibility]
  rowsFor(edits, group) → PropertyRow[]   // STYLE_GROUP maps each StyleProperty to fill|typography|layout
  → PropertySection(title = copy.panel.detail.changeGroups[group]) only when rows.length > 0
  → Scope PropertyRow below the sections (Detail renders "Edit on page" after)
Detail meta: copy.panel.detail.meta(path, viewport.w, viewport.h, note.target.state)
LoadingView: role=status > .fv-sr-only copy.panel.states.loading
Locator: LocatorBlock(label = locatorParts.{domPath,selector,html}) > pre.fvp-code
ErrorToast: Toast onClose = actions.dismissError(key), closeLabel = copy.toasts.dismiss (8 s auto-dismiss kept, optional)
NoResultsView({query}): query === '' ? noResults.filterLine : noResults.line(query)
reorder: NoteGroup(next group ids) → NoteList.flatten(all visible groups, this one replaced) → actions.reorder(full ordered ids)
```

### Files
| path | action | purpose |
| --- | --- | --- |
| src/sidepanel/ui/DetailChanges.tsx | modified | Text/Fill/Typography/Layout/Visibility sections, before/after swatches |
| src/sidepanel/ui/Detail.tsx | modified | meta uses note.target.state |
| src/sidepanel/ui/States.tsx | modified | loading text, filterLine, NoResultsView drops filters prop |
| src/sidepanel/ui/App.tsx | modified | NoResultsView call |
| src/sidepanel/ui/Locator.tsx | modified | sub-labels |
| src/sidepanel/ui/Toasts.tsx | modified | Dismiss button on error toasts |
| src/sidepanel/ui/panel.css | modified | .fvp-changes, .fvp-change__side/__to, .fvp-locator__part/__label |
| src/sidepanel/ui/App.test.tsx | modified | 45 tests (was 38 reported; +7) |
| .orch/returns/W4-panel-ui-fix1.2.md | created | this return |

### Exports
Unchanged: App, sidePanelCss, THUMB_MIN_WIDTH.

### Errors handled
| error tag | strategy | where |
| any non-inline error key | escape: toast with Dismiss button (plus 8 s auto-dismiss) | Toasts |
| others | unchanged from attempt 1 | |

### Verification
| command | exit | tail |
| --- | --- | --- |
| npx vitest run src/sidepanel/ui | 0 | Test Files 2 passed (2), Tests 45 passed (45) |
| npm run typecheck | 0 | wxt prepare ok, tsc --noEmit clean (one earlier run exited 2 while the other worker was mid-edit; rerun clean) |
| npx eslint src/sidepanel/ui src/entrypoints/sidepanel --max-warnings 0 | 0 | no output |
| npm run build | 0 | Finished in 907 ms, total 1.53 MB |

### Coverage
Not measured. New tests: Detail sections for color + padding + hidden (Fill, Layout, Visibility only, in order), Text/Fill sections in the text+style case, meta shows target state, locator sub-labels, loading text, filter-only no-results, Dismiss button, reorder with full group (3 rows) and with another group present.

### Deviations
- Reorder: `actions.reorder` receives every visible id (moved group replaced by its new order, other groups unchanged), a superset of the group; mergeOrder refills only the passed slots, so the group's new order is applied. Left as in attempt 1; tests now pin it.
- Style row value shows before and after with a CSS-generated arrow glyph (no copy string exists for a bare before/after pair); row label is the CSS property name.
- Visibility row label reuses `copy.panel.search.chips.hide`.
- Scope row is a standalone PropertyRow below the sections, shown only when at least one section renders.

### Needs
none
