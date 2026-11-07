## Node Return — W2-storage-fix1 attempt 1
status: done

### Implemented graph
```ts
SessionStoreLive = Layer.sync(SessionStore, makeSessionKv)
makeSessionKv(getChrome) = { ...makeAreaKv('session'), allowContentAccess }
allowContentAccess: resolveChrome → chrome.storage.session.setAccessLevel({accessLevel:'TRUSTED_AND_UNTRUSTED_CONTEXTS'})
   // E: missing chrome / missing setAccessLevel / rejection → StorageUnavailable (escape)
SessionStoreMemory(control) = Layer.sync(SessionStore, makeMemorySessionKv(control))
makeMemorySessionKv = { ...makeMemoryKv, allowContentAccess: Effect.sync(control.recordContentAccess) }  // no-op, counted
```

### Files
| path | action | purpose |
| --- | --- | --- |
| src/storage/types.ts | modified | SessionKvService = KvService + allowContentAccess |
| src/storage/area-kv.ts | modified | optional setAccessLevel on StorageAreaLike; makeSessionKv |
| src/storage/memory-kv.ts | modified | FaultControl.contentAccessGrants/recordContentAccess; makeMemorySessionKv |
| src/storage/services.ts | modified | SessionStore typed SessionKvService; layers use new factories |
| src/storage/index.ts | modified | export SessionKvService type |
| src/storage/area-kv.test.ts, memory-kv.test.ts | modified | new tests |

### Exports
- SessionStore service type is now SessionKvService (adds `allowContentAccess: Effect<void, StorageUnavailable>`); type SessionKvService exported.
- FaultControl gains `contentAccessGrants(): number` and `recordContentAccess()`.
- ChromeStorage / KvService unchanged.

### Errors handled
| error tag | strategy | where |
| --- | --- | --- |
| StorageUnavailable | escape | makeSessionKv.allowContentAccess (no chrome, no setAccessLevel, rejection) |

### Verification
| command | exit | tail |
| --- | --- | --- |
| npx vitest run src/storage --coverage ... | 0 | 5 files, 38 tests passed; Lines 98.3% |
| npm run typecheck | non-zero (not mine) | only `src/platform/live.test.ts(94,24): Cannot find name 'run'` (parallel worker); no errors elsewhere, none in storage or consumers |
| npx eslint src/storage --max-warnings 0 | 0 | clean |
Coverage dir .orch/tmp-cov-storage deleted.

### Coverage
Stmts 97.66, Branch 95.16, Funcs 96.47, Lines 98.3 (src/storage).

### Deviations
- Task item 2: chose a separate SessionKvService (extends KvService) rather than optional method on KvService; smallest change keeping ChromeStorage untouched.
- Memory no-op is recorded as a counter on FaultControl (the shared control passed to SessionStoreMemory).
- StorageAreaLike.setAccessLevel is optional so existing fakes compile; absent → StorageUnavailable.

### Needs
- W3-background: call `(yield* SessionStore).allowContentAccess` at startup. Re-run typecheck once W2-messaging-platform-fix1 fixes src/platform/live.test.ts.
