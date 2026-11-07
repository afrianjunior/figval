## Node Return — W1-domain attempt 1
status: done

### Implemented graph
```ts
domain (pure, no R, no E except schema decode failures at edges)
  ids: makeSessionId(rng) / makeUuidV4(randomBytes) → makeNoteId|makeShotId → Schema.decodeSync(brand)
  records: Settings, Session, Note, Target, Edits ... (Schema.Struct, readonly)
  draft: NoteDraft, NotePatch (decoded by consumers at content→background boundary)
  derive: hasEdits → intent → tags; normalizePage → normalizePageKey; groupByPage = sortByOrder → bucket by pageKey
  errors: Schema.TaggedError classes (InvariantViolation = die)
```

### Files
| path | action | purpose |
| src/domain/ids.ts | created | branded IDs, pure generators, formatSeq |
| src/domain/records.ts | created | record schemas, defaultSettings, emptyEdits, STYLE_PROPERTIES |
| src/domain/draft.ts | created | NoteDraft, NotePatch |
| src/domain/errors.ts | created | tagged errors, ErrorTag, DomainError |
| src/domain/derive.ts | created | derive fns, page normalization, groupByPage |
| src/domain/index.ts | modified | barrel |
| src/domain/{ids,derive,schemas}.test.ts | created | tests (38) |

### Exports
ids: SessionId, NoteId, ShotId, NoteSeq, TabId (schemas+types); makeSessionId(rng)=>SessionId; makeUuidV4(randomBytes)=>string; makeNoteId/makeShotId(randomBytes); formatSeq(seq)=>"FV-n".
records: Settings, Session, Note, Target, DomStep, TargetAttrs, Selection, Edits, TextEdit, StyleChange, StyleProperty, STYLE_PROPERTIES, Preset, TooltipTab, Viewport, PageInfo, Shots, defaultSettings, emptyEdits.
draft: NoteDraft, NotePatch.
errors: 13 §4 errors + NoteSaveError, ErrorTag, DomainError.
derive: hasEdits, intent, tags, normalizePage(url)=>{host,path}, normalizePageKey(url)=>string, groupByPage(notes, order)=>readonly {pageKey,host,path,notes}[]; types NoteTag, Intent, NormalizedPage, PageGroup.

### Errors handled
| error tag | strategy | where |
| all | defined only; strategies applied by consumers per §6 (InvariantViolation = die) | errors.ts |

### Verification
| command | exit | tail |
| npm run typecheck (tsc clean; earlier run transiently failed on another worker's src/copy file, since resolved) | 0 | no errors |
| npx vitest run src/domain --coverage --coverage.include='src/domain/**' | 0 | 3 files, 38 tests passed |
| npm run lint | 0 | clean |

### Coverage
src/domain: Statements 100%, Branches 100%, Functions 100%, Lines 100% (81/81).

### Deviations
- §4 checklist 3: NotePatch uses flat `label` (maps to target.label); NoteDraft carries label inside `target` only, no separate label field.
- normalizePage keeps port in host (localhost:3000); invalid URL returns {host:'', path:input}.
- groupByPage: notes absent from `order` are appended after ordered ones in input order.
- InvariantViolation is a TaggedError class to be used with Effect.die; included in ErrorTag.

### Needs
none
