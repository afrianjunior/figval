## Node Return — W2-storage attempt 1
status: done

### Implemented graph
```ts
cascadeDeleteSession(sessionId)            // R: SessionRepo | NoteRepo | ShotStore; E: RepoError | ShotStoreError
  → NoteRepo.list(sessionId) → NoteRepo.removeAll → SessionRepo.remove → ShotStore.removeMany(shot ids)
Repos (Layer.effect over ChromeStorage)    // E: StorageQuotaExceeded | StorageCorrupt | StorageUnavailable
  SettingsRepo.get/put/stream → ChromeStorage.get/set/changes → decodeWhole(Settings) (absent → defaultSettings)
  SessionRepo/NoteRepo → makeCollection(kv, key, spec)
     read: kv.get(key) → decodeEntries (container not array → StorageCorrupt; bad element → skipped, counted) → Listing{items, corrupt}
     write: read entries → apply change on raw array (corrupt raws preserved) → kv.set (conflict → die InvariantViolation)
     stream: merge(initial tick, kv.changes filtered by key) → re-read list
ChromeStorageLive / SessionStoreLive → makeAreaKv(area) → chrome.storage.{local,session}
   set failure → /quota/i ? getBytesInUse → StorageQuotaExceeded : StorageUnavailable
   changes → Stream.asyncPush + acquireRelease(onChanged add/remove listener), filtered by area
ShotStoreLive → Layer.scoped(acquireRelease(open IndexedDB 'figval-shots'/'shots', close)) → ShotStoreError{op}
```
```ts
// Tests: same graph, R swapped
ChromeStorageMemory(FaultControl) (Map + listener set; quota/unavailable faults), SessionStoreMemory, ShotStoreMemory (Map)
StorageMemory = makeStorageMemory(control?) ; ShotStore Live tested with fake-indexeddb; adapter tested with fake chrome object
```

### Files
| path | action | purpose |
| --- | --- | --- |
| src/storage/types.ts | created | KvService, StorageChange, RepoError, Listing |
| src/storage/keys.ts | created | key helpers (settings, sessions, notes:<id>) |
| src/storage/area-kv.ts | created | chrome.storage adapter (local/session), quota mapping, onChanged stream |
| src/storage/memory-kv.ts | created | in-memory KV + FaultControl |
| src/storage/services.ts | created | ChromeStorage, SessionStore tags and Live/Memory layers |
| src/storage/decode.ts | created | decode edges, migrate hook |
| src/storage/collection.ts | created | generic array-of-records repo core |
| src/storage/{settings,session,note}-repo.ts | created | repos |
| src/storage/shot-store.ts, shot-store-idb.ts | created | ShotStore tag, memory layer, IndexedDB scoped layer |
| src/storage/cascade.ts | created | cascadeDeleteSession |
| src/storage/layers.ts | created | StorageLive, StorageMemory, makeStorageMemory |
| src/storage/index.ts | modified | barrel |
| src/storage/fixtures.ts | created | test fixtures (not exported from barrel) |
| src/storage/*.test.ts (memory-kv, area-kv, repos, cascade, shot-store) | created | tests |
| .orch/returns/W2-storage.1.md | created | this return |

### Exports
- ChromeStorage, SessionStore — Context.Tag<KvService> — get/set/remove/changes
- ChromeStorageLive, SessionStoreLive — Layer — chrome.storage.local/session
- ChromeStorageMemory(control?), SessionStoreMemory(control?) — Layer factories — memory test layers
- makeFaultControl(), Fault, FaultControl — simulate quota/unavailable in tests
- SettingsRepo/SessionRepo/NoteRepo (+ *Live, *Service types) — repos; list returns Listing{items, corrupt}; get returns Option
- ShotStore, ShotStoreMemory, makeMemoryShotStore, ShotStoreLive, makeShotStoreLive(dbName), SHOT_DB_NAME
- cascadeDeleteSession(id) — Effect<void, RepoError | ShotStoreError, SessionRepo | NoteRepo | ShotStore>
- StorageLive, StorageMemory, makeStorageMemory(control?) — composite layers (provideMerge, so ChromeStorage is also output)
- migrate(schemaVersion, raw), SETTINGS_KEY, SESSIONS_KEY, notesKey, storageKeys, types KvService/StorageChange/Listing/RepoError/RepoReadError

### Errors handled
| error tag | strategy | where |
| --- | --- | --- |
| StorageUnavailable | escape | area-kv (missing chrome, API rejection); repos pass through |
| StorageQuotaExceeded | escape | area-kv.set via getBytesInUse (0 if unreadable); memory fault |
| StorageCorrupt | escape (element: skip+count; container/settings: fail) | decode.ts, collection, settings-repo |
| ShotStoreError | escape | shot-store-idb (open/put/get/replace/remove), memory put-on-existing |
| InvariantViolation | die | collection insert (dup id/seq), replace of unknown id |

### Verification
| command | exit | tail |
| --- | --- | --- |
| npx vitest run src/storage --coverage --coverage.include='src/storage/**' | 0 | 5 files, 34 tests passed; Lines 98.65% (220/223), Stmts 97.9%, Branch 96.55% |
| npm run typecheck | 0 | wxt prepare ok, tsc --noEmit clean |
| npm run lint | 0 | eslint . --max-warnings 0 clean |

### Coverage
src/storage: lines 98.65, statements 97.9, branches 96.55, functions 96.91 (uncovered: area-kv.ts L71 defensive branch, shot-store-idb.ts L16/L28 error callbacks).

### Deviations
- §6 / checklist 3 — SessionRepo.replace and NoteRepo.replace on an unknown id die with InvariantViolation (spec only named insert); keeps E to the three storage errors.
- Checklist 3 — corrupt count is exposed via `list` returning `{items, corrupt}`; streams emit items only (no separate RepoHealth service).
- Checklist 1 — `changes` is `Stream<StorageChange, StorageUnavailable>` (fails when `chrome.storage` is missing) instead of an infallible stream.
- Checklist 4 — `put` fails if the id exists (IndexedDB `add`); `replace` overwrites. `remove(id)` takes one id and `removeMany(ids)` takes many.
- Streams emit the current value first, then re-read on each change; the initial read can race the subscription by one tick, but each emission is the latest decoded state.
- ShotStore test file uses `// @vitest-environment node` because happy-dom's Blob is not structured-cloneable by fake-indexeddb.
- ChromeStorageLive adapter is covered via a fake `ChromeLike` object (no coverage exclusion needed).
- cascadeDeleteSession skips corrupt notes (their shots, if any, stay orphaned).
- Prettier was applied to src/storage only.

### Needs
none
