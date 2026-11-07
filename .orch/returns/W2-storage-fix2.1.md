## Node Return — W2-storage-fix2 attempt 1
status: done

### Implemented graph
```ts
makeStorageMemory(control?) = mergeAll(ReposLive.provideMerge(ChromeStorageMemory(control)), SessionStoreMemory(control), ShotStoreMemory)
```

### Files
| path | action | purpose |
|---|---|---|
| src/storage/layers.ts | edit | pass same control to SessionStoreMemory |
| src/storage/repos.test.ts | edit | test: makeStorageMemory(control) -> SessionStore.allowContentAccess -> contentAccessGrants() === 1 |

### Exports
unchanged

### Errors handled
| error tag | strategy | where |
|---|---|---|
| n/a | unchanged | n/a |

### Verification
| command | exit | tail |
|---|---|---|
| npx vitest run src/storage | 0 | 5 files, 39 tests passed |
| npx vitest run src/background | 0 | 3 files, 39 tests passed |
| npm run typecheck | 0 | clean (an earlier mid-run attempt showed transient src/copy errors from W1; rerun exit 0) |
| npx eslint src/storage --max-warnings 0 | 0 | no output |

### Coverage
n/a

### Deviations
none

### Needs
none
