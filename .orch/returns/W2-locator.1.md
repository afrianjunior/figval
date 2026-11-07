## Node Return — W2-locator attempt 1
status: done

### Implemented graph
```ts
buildTarget(el, range?, opts?)           // pure, no Effect
  → autoLabel(el) → stableClasses → isHashedClass
  → visibleText(el) → clip(200)
  → buildDomPath(el) → landmark walk, last 6, nth only if same-tag siblings
  → uniqueSelector(el, doc) → testid | stable #id | tag.class chain | nth-of-type chain | full path
  → trimHtml(el, 2048) → strip data-fv-* / Figval contenteditable, collapse children
  → buildSelection(el, range) → nearestBlock(el) text ±80
parentTarget / childTarget → buildTarget
findElement(target, doc)                 // testid → id → selector → text+tag → domPath (each must be unique)
findElementEffect(target, doc, noteId)   // edge: fail ElementNotFound
findSimilar(el, doc) → { selector, count }
```

### Files
| path | action | purpose |
|---|---|---|
| src/locator/index.ts | modified | barrel |
| src/locator/build.ts | created | buildTarget, buildDomPath, parentTarget, childTarget |
| src/locator/find.ts | created | findElement, findElementEffect |
| src/locator/selector.ts | created | uniqueSelector |
| src/locator/similar.ts | created | findSimilar |
| src/locator/label.ts | created | autoLabel |
| src/locator/html.ts | created | trimHtml |
| src/locator/hashed.ts | created | isHashedClass, stableClasses |
| src/locator/dom.ts | created | nearestBlock |
| src/locator/css.ts, text.ts | created | escape/query/text helpers |
| src/locator/fixtures.ts | created | test helper loading tests/fixtures into happy-dom |
| src/locator/locator.test.ts | created | 50 tests |

### Exports
- buildTarget — (el, range?, opts?: {state}) => Target — element/text target
- buildDomPath — (el) => DomStep[] — landmark to element, max 6
- parentTarget / childTarget — (el, opts?) => Target | null — picker up/down
- findElement — (target, doc) => Element | null — fallback chain
- findElementEffect — (target, doc, noteId) => Effect<Element, ElementNotFound>
- findSimilar — (el, doc) => { selector, count }
- autoLabel — (el) => string
- trimHtml — (el, max) => string
- uniqueSelector — (el, doc) => string
- isHashedClass — (name) => boolean; stableClasses — (el) => string[]
- nearestBlock — (node) => Element
- types BuildOptions, SimilarResult

### Errors handled
| error tag | strategy | where |
|---|---|---|
| ElementNotFound | escape (typed failure) | findElementEffect |
| invalid selector (SyntaxError) | escape (treated as no match, chain continues) | css.queryAll |

### Verification
| command | exit | tail |
|---|---|---|
| npx vitest run src/locator --coverage --coverage.include='src/locator/**' | 0 | Tests 50 passed (50); All files 95.23% stmts / 87.98% branch / 96.92% funcs / 95.54% lines |
| npm run typecheck | non-zero, none in src/locator | all errors in src/messaging/{protocol,live,messenger}.ts (W2-messaging-platform, Schema Void/Null transform types); re-run once it settles |
| npm run lint | 0 | eslint . --max-warnings 0 clean |

### Coverage
src/locator: lines 95.54%, statements 95.23%, branches 87.98%, functions 96.92% (threshold 85%).

### Deviations
- §4/card hashed regex `/^(css|sc|jsx|emotion)-|[a-z0-9]{6,}$/` — implemented as prefix check OR `^(?=[a-z0-9]*\d)[a-z0-9]{6,}$` (case-insensitive) — the card's unanchored form flags stable classes like btn-primary and save-button ("primary", "button" are 6+ chars at the end).
- buildTarget selection context — taken from nearestBlock(el), not the range's common ancestor — el is the Edit-tab block target; avoids context bleeding to body.
- findElement text+tag and domPath steps return a match only when unique, else null — avoids silently selecting the wrong element.
- tests use the global happy-dom `document` for Range tests — happy-dom ranges from DOMParser documents collapse.
- autoLabel for tags with no role noun uses humanized first stable class ("Promo banner"), else the tag.

### Needs
none (typecheck failures belong to src/messaging, owned by W2-messaging-platform)
