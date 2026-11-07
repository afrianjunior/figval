## Node Return — W3-edit-engine attempt 1
status: done

### Implemented graph
```ts
computeBaseline(el) → getComputedStyle → Baseline (toHex colors, four-side padding)
toDiff(Baseline, DraftEdits) → Edits (only changed props; padding before = four-side)
preview(el, Edits, doc) → clearPreview(el) → targetsOf(el, edits, similarSelector) → applyEdits (WeakMap original style/text, setProperty important)
revert(el, doc) → restoreElement for every target the preview touched
makeEditRegistry(doc) → apply/remove/editsOff/editsOn/entries/elementOf (immutable Map replaced per change)
  editsOff → suspendPreviews + release entries; editsOn → paint entries + resumePreviews
watchReapply(registry, doc, resolve) → acquireRelease(MutationObserver → sliding Queue) → Stream.fromQueue
  → debounce 100ms → runForEach(resolve each entry; element changed → registry.apply) → forkScoped
startTextEdit(el) → acquireRelease(contenteditable + dashed outline; release restores) → { current, onInput: Stream<string> }
pageSwatches(doc, max=8) → computed color/background → toHex → opaque only → frequency sort
```

### Files
| path | action | purpose |
|---|---|---|
| src/content/edit/color.ts | created | toHex, isOpaqueHex |
| src/content/edit/baseline.ts | created | Baseline, computeBaseline, editableText |
| src/content/edit/diff.ts | created | DraftEdits, toDiff |
| src/content/edit/apply.ts | created | preview/revert, apply/restore core, suspend/resume previews |
| src/content/edit/registry.ts | created | EditRegistry |
| src/content/edit/reapply.ts | created | watchReapply |
| src/content/edit/textEdit.ts | created | startTextEdit, TextEditSession |
| src/content/edit/swatches.ts | created | pageSwatches |
| src/content/edit/index.ts | modified | barrel |
| src/content/edit/edit.test.ts | created | 22 tests |

### Exports
computeBaseline(el) → Baseline; Baseline; preview(el, edits, doc); revert(el, doc); toDiff(baseline, draft: DraftEdits) → Edits; DraftEdits; makeEditRegistry(doc) → EditRegistry; EditRegistry (contract + elementOf(noteId)); watchReapply(registry, doc, resolve) → Effect<void, never, Scope>; startTextEdit(el) → Effect<TextEditSession, never, Scope>; TextEditSession {current(): string; onInput: Stream<string>}; pageSwatches(doc, max?) → readonly string[]; toHex(css) → string.

### Errors handled
| error tag | strategy | where |
|---|---|---|
| invalid similarSelector (DOMException) | escape (falls back to the element alone) | apply.ts targetsOf |
| all Effects have E = never | n/a | no chrome/IO failures in this node |

### Verification
| command | exit | tail |
|---|---|---|
| npx vitest run src/content/edit --coverage --coverage.include='src/content/edit/**' | 0 | 22 passed; Statements 97.15%, Branches 89.93%, Functions 98.64%, Lines 98.5% |
| npm run typecheck | 0 | wxt prepare ok; tsc --noEmit no output |
| npx eslint src/content/edit --max-warnings 0 | 0 | no output |

### Coverage
src/content/edit: lines 98.5%, statements ~97%, branches ~90%, functions ~98.6%.

### Deviations
- Contract: TextEditSession exposes `onInput: Stream<string>` (the contract said "onInput stream"). EditRegistry gained `elementOf(noteId)`, needed by watchReapply.
- `DraftEdits` was not defined upstream; defined here (text|null, style partial map of control values, hidden, scope, similarSelector, similarCount). Padding axes carry one value applied to both sides.
- Baseline.style['padding-block'/'padding-inline'] is a single value when both sides are equal, else "a b" (top bottom / left right).
- toDiff drops style changes when hidden is true (spec: hide disables other style controls). scope 'similar' without a selector degrades to 'this'.
- Text edits apply only to the root element, not to other similar matches; similar scope applies style and hidden.
- Bookkeeping uses module-level WeakMap (original style/text) and a Map of active previews (DOM bookkeeping, acceptable per card). If a preview is reverted on an element that also has registry edits, the registry's edits on that element are cleared until editsOn/apply is called again; callers should re-apply via the registry (tooltip editing an existing note should call registry.apply, not preview).
- contenteditable is set to "plaintext-only" (avoids rich-text markup in textContent); outline restored by property, or the exact style attribute when untouched.
- Locator imports are not used: the barrel lives at src/locator (not src/content/locator); this node did not need it.
- revert's `doc` param is unused (kept for contract).

### Needs
none
