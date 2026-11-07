## Node Return — W3-edit-engine-fix1 attempt 1
status: done

### Implemented graph
```ts
// module-private WeakMap<Document, Store> (DOM bookkeeping, keyed by document)
Store = { saved: Map<Element,Saved>, targets: Map<Element,Element[]>, edits: Map<Element,Edits> }
preview(el,edits,doc) -> clearPreview -> paintPreview   (store of doc)
revert(el,doc)        -> clearPreview
suspendPreviews(doc) / resumePreviews(doc) / activePreviews(doc)
disposeEdits(doc): restore all saved elements, clear store, drop WeakMap entry
registry.release(): disposeEdits(doc); entries = empty; on = true
```

### Files
| path | action | purpose |
| src/content/edit/apply.ts | edit | module-level Map/WeakMaps replaced by per-document store; disposeEdits |
| src/content/edit/registry.ts | edit | release(); passes doc to suspendPreviews |
| src/content/edit/index.ts | edit | export disposeEdits |
| src/content/edit/edit.test.ts | edit | 3 tests: documents isolated, dispose restores/empties, release |

### Exports
New: `disposeEdits(doc)` (apply.ts, index.ts), `EditRegistry.release()`.
Changed: `suspendPreviews(doc)` and `activePreviews(doc)` now take a Document (both internal to the edit folder; not exported from index, no outside callers). preview/revert signatures unchanged.

### Errors handled
| error tag | strategy | where |
| invalid similarSelector | escape (falls back to [el]) | targetsOf (unchanged) |

### Verification
| command | exit | tail |
| vitest edit --coverage | 0 | 25 passed |
| eslint src/content/edit --max-warnings 0 | 0 | clean |
| tsc grep src/content/edit | - | no output |

### Coverage
Lines 98.66%, Statements 97.77%, Branches 90.19%, Functions 100%. tmp-cov-edit deleted.

### Deviations
Chose the module-private WeakMap<Document, Store> option (DOM bookkeeping). restoreElement finds its store via el.ownerDocument.

### Needs
- (owner content-core) Call `registry.release()` (or `disposeEdits(document)`) in the content scope finalizer (Effect.addFinalizer / onInvalidated) so previews and registry edits are reverted on scope close.
