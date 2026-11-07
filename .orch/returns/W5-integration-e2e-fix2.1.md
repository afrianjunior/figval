## Node Return — W5-integration-e2e-fix2 attempt 1
status: done

### Implemented graph
```ts
settle(page): rAF x2 -> Promise.allSettled(finite animations in document + every open shadow root) -> rAF x2
// called after every emulateMedia({colorScheme}) in screenshots.spec.ts (2 sites) and screenshots-states.spec.ts (9 sites)
```

### Files
| path | action | purpose |
|---|---|---|
| tests/e2e/helpers.ts | edit | add exported `settle` |
| tests/e2e/screenshots.spec.ts | edit | import + call settle after emulateMedia |
| tests/e2e/screenshots-states.spec.ts | edit | import + call settle after emulateMedia |

### Exports
`settle(page: Page): Promise<void>` in tests/e2e/helpers.ts

### Errors handled
| error tag | strategy | where |
|---|---|---|
| infinite animations never finishing | filtered out (iterations === Infinity) | settle |
| animation cancelled mid-wait | Promise.allSettled tolerates rejection | settle |

### Verification
| command | exit | tail |
|---|---|---|
| npx eslint tests/e2e --max-warnings 0 | 0 | no output |
| npx tsc --noEmit 2>&1 \| grep "tests/e2e" | 1 (grep no match) | no output |

### Coverage
n/a

### Deviations
Walks shadow roots by scanning document elements for open `shadowRoot` (all, not only figval-root) via `root.getAnimations()` rather than `document.getAnimations({subtree})`, which does not reliably cover shadow trees. Infinite animations excluded so the wait cannot hang. e2e not run per instructions.

### Needs
none
