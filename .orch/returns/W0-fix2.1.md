## Node Return — W0-fix2 attempt 1
status: done

### Implemented graph
```ts
coverage: {
  provider: 'v8',
  include: ['src/**/*.{ts,tsx}'],
  exclude: [tests, __fixtures__, src/entrypoints/**, *.d.ts, test-kit/store-kit/test-support/test-harness/fixtures, fake-chrome.ts],
  reportsDirectory: 'coverage',
  reporter: ['text-summary','text','html'],
  thresholds: { lines:80, statements:80, functions:80, branches:75, + per-glob lines thresholds per node cards },
}
```

### Files
| path | action | purpose |
| vitest.config.ts | edit | real coverage gate: scoped include/exclude, thresholds, reporters |

### Exports
none

### Errors handled
| error tag | strategy | where |
| coverage threshold miss | vitest exits non-zero | coverage.thresholds |

### Verification
| command | exit | tail |
| npm run coverage | 0 | summary: Statements 91.61, Branches 83.56, Functions 90.43, Lines 92.64; no threshold errors |
| grep -c PARSE_ERROR | 0 | 0 |
| npm run typecheck | 0 | WXT types generated, clean |
| npm run lint | 0 | eslint --max-warnings 0 clean |

### Coverage
Totals: lines 92.64, statements 91.61, functions 90.43, branches 83.56.
Per-folder lines: domain 100, markdown 100, locator 95.5, storage 98.3, messaging 100, platform 100, background 98.9, content/edit 98.5, sidepanel/model 98.9. (domain/messaging rows are omitted from the text table but confirmed via json-summary.)

### Deviations
- src/platform/test-driver.ts NOT excluded: it is imported by production platform modules (layers.ts, tabs.ts) and re-exported from index.ts.
- Excluded src/platform/fake-chrome.ts (only imported by tests).

### Needs
none
