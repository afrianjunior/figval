## Node Return — W3-content-core-fix3 attempt 1
status: done

### Implemented graph
```ts
const registry = makeEditRegistry(doc);
yield* Effect.addFinalizer(() => Effect.sync(() => registry.release()));
```
Finalizer is registered right after the registry is created, so (finalizers run LIFO) it runs after the marker layer and picker finalizers declared later.

### Files
| path | action | purpose |
|---|---|---|
| src/content/main.ts | edit | release registry in content scope finalizer |
| src/content/markers/router.test.ts | edit | test: registry edit reverted and store emptied after scope close (RED before fix, GREEN after) |

### Exports
unchanged

### Errors handled
| error tag | strategy | where |
|---|---|---|
| none (release is sync, infallible) | n/a | main.ts |

### Verification
| command | exit | tail |
|---|---|---|
| npx vitest run src/content/picker src/content/markers | 0 | Test Files 4 passed (4); Tests 33 passed (33) |
| npx eslint src/content/main.ts src/content/markers src/content/picker --max-warnings 0 | 0 | no output |
| npx tsc --noEmit \| grep -E "src/content/(main\|markers\|picker)" | - | prints nothing |

### Coverage
n/a

### Deviations
none

### Needs
none
