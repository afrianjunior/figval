## Node Return — W2-markdown-fix2 attempt 1
status: done

### Implemented graph
```ts
// pure string escaping, no Effect/R involved
escape.ts: collapse | oneLine | escapeQuotes | quoted | inlineCode
llm-note/verify/table/llm  -> page-derived value -> oneLine/quoted/inlineCode -> Markdown
human-note/human           -> same helpers; selector keeps copy's "Selector: " label
HTML + DOM-path fences     -> fenceFor(body) (longer than any backtick run)
```

### Files
| path | action | purpose |
|---|---|---|
| src/markdown/escape.ts | new | helpers |
| src/markdown/escape.test.ts | new | helper unit tests |
| src/markdown/llm-note.ts | edit | escape text, attrs, selection, context, selector, change text, DOM path, label; own html fence |
| src/markdown/verify.ts | edit | quoted `reads`, inlineCode style values and page path |
| src/markdown/table.ts | edit | cell via inlineCode |
| src/markdown/llm.ts, human.ts | edit | page title/URL via oneLine |
| src/markdown/human-note.ts | edit | label, text change, attrs, selector |
| src/markdown/__fixtures__/hostile.{input.ts,llm.md,human.md} | new | hostile golden |
| src/markdown/__fixtures__/cases.ts | edit | register hostile case (+2 lines) |
| src/markdown/golden.test.ts | edit | hostile structure assertions |

### Exports
New `src/markdown/escape.ts`: `collapse`, `oneLine`, `escapeQuotes`, `quoted`, `inlineCode`. Nothing removed.

### Errors handled
| error tag | strategy | where |
|---|---|---|
| none (pure) | n/a | n/a |

### Verification
| command | exit | tail |
|---|---|---|
| vitest src/markdown --coverage | 0 | 6 files, 101 tests passed; all 9 existing goldens unchanged |
| eslint src/markdown --max-warnings 0 | 0 | clean |
| tsc --noEmit \| grep src/markdown | n/a | no output |
| git diff --stat __fixtures__ | n/a | only cases.ts (+2); hostile.* are untracked new files |

### Coverage
Lines 100%, statements 99.45%, branches 96.53%, functions 100%. .orch/tmp-cov-md deleted.

### Deviations
- `cases.ts` edited (2 lines) to register the golden; required for the golden test to pick up hostile.
- Context line uses `collapse`/`escapeQuotes` (no trim) so edge spaces like "used by " stay byte-identical; `quoted` does trim per spec.
- Human selector line reuses the copy label via `h.technical.selector('').slice(0,-2)` because src/copy is not mine; value is fenced with inlineCode.
- Human style lines (`h.styleChanged`, `paddingBoth`) still wrap values with copy's plain backticks; src/copy is not mine (CSS values are computed/schema-bound).
- why/comment (user-authored, not page-derived) left as is.
- Also oneLine'd page titles/URLs in the page heading (page-derived).

### Needs
Optional, src/copy/human.ts: make `code()` in markdownHuman use a backtick-safe inline-code helper for style values.
