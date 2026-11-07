## Node Return — W1-copy attempt 1
status: done

### Implemented graph
```ts
// pure data + pure functions, no Effect/R/E
strings.ts: copy = { panel, tooltip, picker, keys, errors, toasts, markdownHuman }
  panel.ts (header, toolbar, search, list, states.*, detail, footer, sessions, settings)
  tooltip.ts (tooltip, picker, keys, toasts)
  errors.ts (ERROR_TAGS tuple -> errors Record<ErrorTag,string>)
  human.ts (markdownHuman)
  plural.ts, format.ts (pure helpers, UTC dates)
  -> index.ts barrel -> production
```

### Files
| path | action | purpose |
| src/copy/strings.ts | created | composes `copy`, `Copy` type |
| src/copy/panel.ts | created | side panel strings |
| src/copy/tooltip.ts | created | tooltip, picker, keys, toasts |
| src/copy/errors.ts | created | ERROR_TAGS + one line per tag |
| src/copy/human.ts | created | Human markdown phrasing |
| src/copy/plural.ts, format.ts | created | helpers |
| src/copy/*.test.ts (3) | created | plural, format, strings tests |
| src/copy/index.ts | modified | barrel |

### Exports
copy, Copy, ErrorTag, ERROR_TAGS, plural(n, one, many), count(n, one, many), formatLongDate(ts), formatShortDate(ts), defaultSessionName(host, ts), STYLE_PROPERTIES, CopyStyleProperty.

### Errors handled
| error tag | strategy | where |
| all 14 tags | n/a (copy only) | copy.errors.<Tag> |

### Verification
| command | exit | tail |
| npm run typecheck | 0 | tsc --noEmit clean |
| npx vitest run src/copy | 0 | 3 files, 12 tests passed |
| npm run lint | 0 | no warnings |

### Coverage
not requested.

### Deviations
- §11.1/§11.4 title: "Website review — x" -> "Website review: x" (em dash banned by antislop R-02). W2-markdown goldens must use the colon form.
- §11.4 screenshot hint: "📎 _Screenshot available in Figval: FV-1_" -> "_Screenshot available in Figval: FV-1_" (emoji dropped, humanizer §20).
- Other wording kept from the spec; error/state lines are new text written to match §6/§10.2 meaning.
- Dates formatted in UTC so output is machine-independent.
- Style property keys in markdownHuman use the domain literals (background-color, padding-block...) copied locally, no domain import.

### Needs
- W2-markdown: update Human title fixture and drop the emoji.
- UI: render keys.* in Kbd; search.hint has mac/other variants.
