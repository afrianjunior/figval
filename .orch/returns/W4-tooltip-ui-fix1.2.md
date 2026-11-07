## Node Return — W4-tooltip-ui-fix1 attempt 2
status: done

### Implemented graph
```ts
EditTab (components/EditTab.tsx)
  color(prop)       -> ColorRow{ swatchButtonLabel=colorRow.openPicker, hexLabel=colorRow.hexField, pickerLabel=colorRow.picker, swatchesLabel=colorRow.pageSwatches }
  font-size         -> ScrubNumber{ label=controls.fontSize, handle=handles.fontSize }
  font-weight       -> Select{ aria-label=controls.fontWeight, options=weightOptions(current) }   // fontWeightOption(w); unknown current weight is added as a bare number
  padding-block/-inline -> ScrubNumber{ label=controls.padding*, handle=handles.padding* }          // was Slider
  border-radius     -> ScrubNumber{ label=controls.radius, handle=handles.radius }
tooltip.css: segmented text tabs, hairline above the first fields section, handle column width, reduced-motion rule kept
Controller, layer API, reducer: unchanged
```

### Files
| path | action | purpose |
| src/content/tooltip/components/EditTab.tsx | modified | colorRow names, handles.*, fontWeightOption labels, padding as scrub fields, weightOptions() |
| src/content/tooltip/tooltip.css | modified | tab bar as text segments, divider fix, scrub handle width |
| src/content/tooltip/components/TooltipView.test.tsx | modified | +7 tests (color row names, handle text vs accessible names, weight labels, unnamed weight, reduced-motion CSS, divider CSS) |

### Exports
EditTab now also exports `weightOptions(current: string): { value; label }[]`. Everything else is unchanged.

### Errors handled
| error tag | strategy | where |
| RemoteFailure{tag} | escape: keep content, show copy.errors[tag] above Save | actions.save, Footer (unchanged from attempt 1) |

### Verification
| command | exit | tail |
| npx vitest run src/content/tooltip | 0 | Test Files 4 passed (4); Tests 64 passed (64) |
| npm run typecheck | 0 | wxt prepare && tsc --noEmit, no errors |
| npx eslint src/content/tooltip --max-warnings 0 | 0 | no output |
| npm run build | 0 | Σ Total size: 1.53 MB; Finished |

### Coverage
Not measured. 57 tests kept from attempt 1, 7 added (64 total).

### Deviations
- Skills: invoked antislop, antislop-ui, antislop-human, antislop-layoutmobile, humanizer, antislop-copywriting through the Skill tool, and applied them. The tooltip adds no new strings (all read from src/copy).
- audit: ColorRow reused one label for four accessible names -> fixed. ColorRow already takes four separate props, so no change is needed in src/ui.
- audit: font-weight options were bare numerals -> now `copy.tooltip.edit.fontWeightOption(w)` ("400 Regular", "600 Semibold"). A computed weight that is not in the list (e.g. 450) is added as an option, so the select never shows a blank value.
- audit: padding vertical/horizontal used Slider; §10.1 asks for scrub fields on size/padding/radius -> now ScrubNumber with the "Pad V" / "Pad H" handles. Accessible names stay controls.*. Padding max is now 200 (was max(64, value)).
- audit: S and R scrub handles were bare letters -> now handles.fontSize "Size" and handles.radius "Radius". `.fv-tip .fv-scrub__handle` is 34px wide and left-aligned so the four inputs line up.
- audit: `.fv-section:first-child` removed the hairline above the Fill section, and my own `:first-of-type` rule removed the one under the "Editing" row -> both fixed. There is now a divider between every property section.
- audit: tabs were an underline strip. §10.1 says Comment/Edit are text segments -> restyled as a segmented control (sunken track, raised active segment, selection-blue ring and text on the active one). Still role=tab with arrow-key navigation. Inactive hover wash added, disabled state kept. Height is 24px segment in a 28px track, same as `.fv-seg`.
- audit: focus rings -> every tooltip control inherits `.fv-root :focus-visible` (2px selection blue, plus forced-colors) from the overlay layer. Tabs and scrub fields are covered, no change needed.
- audit: contrast, computed with contrast-check.py -> accent on raised 5.47 (light) / 5.03 (dark); muted on sunken 5.25; muted on selected wash 5.35; propose 5.93 / 6.97; missing 6.05 / 7.14; dark muted on sunken 7.29. All pass AA 4.5.
- audit: reduced motion -> `.fv-tip { animation: none }` is present, and tokens collapse --dur-* to 0.01ms. fv-rise only uses opacity and transform. Locked by a CSS test.
- audit: density -> 12px body (from .fv-root), 13px section titles, 28px rows and controls, 4/8px spacing. No change.
- audit: one accent -> blue is used only for the active tab, focus, selected state, the FV id and the ghost "Add reason" link. The changed dot uses --c-changed and the warnings use --c-propose / --c-missing, each small and muted. No change.
- audit: shortcut hints are muted mono Kbd (Esc, Cmd+Enter) in the footer buttons. No change.
- audit: copy -> no em dashes, emoji, buzzwords or chatbot phrasing in the strings the tooltip renders. All of them come from src/copy and were not touched.
- audit: mobile -> the tooltip is `max-width: calc(100vw - 16px)` and `max-height: min(640px, 100vh - 16px)`, so it does not overflow at 320px. Controls are 28px, per the design-tool density in §10.1 and `--tap-min: 28px`. This is a desktop-Chrome extension, so I did not raise them to 44px, which would contradict §10.1.
- audit: `will-change: transform` stays on `.fv-tip-slot` because the slot is repositioned on every scroll frame. Left as is.
- §10.1 icons: the spec names Lucide, and src/ui owns the icon set (not my folder).

### Needs
none
