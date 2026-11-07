## Node Return — W3-panel-model-fix2 attempt 1
status: done

### Implemented graph
- exportDownload: Effect.gen(...).pipe(Effect.catchAll(failTo(ctx,'export'))) (same as exportCopy).
- toErrorTag: knownTags = ERROR_TAGS + PASSTHROUGH_TAGS (NoteNotFound, SessionNotFound, InvalidOrder, DownloadFailed).
- streams.ts: resubscribe(stream, onError) = tapError(logWarning + onError) -> Stream.retry(Schedule.spaced('1 second')) -> orDie (divergent: unreachable). Used by sessionKey, loop() (settings/sessions/notes/counts/tab/activation/missing/hover; failTo 'storage' still reported) and the notesFeed inner repo.stream. `// divergent:` added on the remaining inline swallows (tabs.get Effect.option, notes corrupt-count orElseSucceed, counts orElseSucceed).

### Files
| path | action | purpose |
| src/sidepanel/model/actions-export.ts | edit | catchAll on exportDownload |
| src/sidepanel/model/context.ts | edit | pass-through error tags |
| src/sidepanel/model/streams.ts | edit | resubscribe on error, divergent comments |
| src/sidepanel/model/test-kit.ts | edit | Handler 2-arg; Harness.failDownload, Harness.failSessionGetOnce |
| src/sidepanel/model/store.test.ts | edit | tests: DownloadFailed, stream resilience, tag pass-through |

### Exports
No signature changes. Harness (test-kit) gains failDownload and failSessionGetOnce.

### Errors handled
| error tag | strategy | where |
| DownloadFailed (and any export failure) | escape -> ui.errors.export | exportDownload |
| NoteNotFound/SessionNotFound/InvalidOrder/DownloadFailed | pass through | toErrorTag |
| StorageUnavailable etc. on live streams | retry (spaced 1s) + logWarning + ui.errors.storage | streams.ts resubscribe |

### Verification
| command | exit | tail |
| vitest src/sidepanel/model --coverage | 0 | 88 passed; Lines 99.25%, Stmts 98.33%, Branches 95.6% |
| eslint src/sidepanel/model --max-warnings 0 | 0 | clean |
| tsc --noEmit \| grep src/sidepanel/model | - | no output |

### Coverage
Lines 99.25 (534/538), statements 98.33, branches 95.6, functions 98.02. Temp coverage dir deleted.

### Deviations
- Download test layer has no failure option (platform not mine); the harness wraps Download so markdown fails with an object tagged 'DownloadFailed' (cast), which works unchanged once the real DownloadFailed class lands. DownloadFailed was not yet exported from src/platform when I checked.
- domain ErrorTag type does not yet list the four tags; pass-through uses a cast.

### Needs
- W1-copy-fix3: copy.errors for the four tags (ERROR_TAGS/ErrorTag), and domain ErrorTag union update if it should include them.
