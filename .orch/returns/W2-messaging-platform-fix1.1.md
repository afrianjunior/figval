## Node Return — W2-messaging-platform-fix1 attempt 1
status: done

### Implemented graph
```ts
NoteCreate{draft, tabId?, rect?: {x,y,w,h}}            // schema field only; wire round-trip via existing encode/decode edges
SessionReorder{id, noteOrder: NoteId[]} → Session       // toBackground (not in contentTags); Request union + replySchemas
Tabs.onUpdated: Stream<TabUpdate{tabId,status?,url?}>
  Live: Stream.asyncPush(acquireRelease(chrome.tabs.onUpdated add/removeListener)) → toUpdate(filter: status∈{loading,complete} | url) 
  Test: Stream.fromPubSub(TestDriver.updateEvents); driver.emitUpdate(update)
```

### Files
| path | action | purpose |
| src/messaging/protocol.ts | modified | NoteCreate.rect, SessionReorder message + reply schema |
| src/messaging/fixtures.ts | modified | sample request/reply for new shapes |
| src/messaging/protocol.test.ts | modified | 23 messages, rect optional/invalid, reorder invalid + direction |
| src/platform/types.ts | modified | TabUpdate type |
| src/platform/tabs.ts | modified | Tabs.onUpdated (Live + Test) |
| src/platform/test-driver.ts | modified | updateEvents PubSub, emitUpdate |
| src/platform/live.test.ts, test-layers.test.ts | modified | onUpdated tests for both layers |

### Exports
- NoteCreate — now has optional `rect` {x,y,w,h} (CSS px, viewport-relative).
- SessionReorder — `tagged('SessionReorder', {id: SessionId, noteOrder: readonly NoteId[]})`; reply value Session; direction toBackground.
- TabUpdate — `{ tabId: number; status?: 'loading'|'complete'; url?: string }` (platform barrel).
- TabsService.onUpdated — `Stream<TabUpdate>`.
- TestDriverService.updateEvents / emitUpdate(update) — test-side control.

### Errors handled
| error tag | strategy | where |
| (none new) | Live listener acquired/released via Scope; non-loading/complete statuses (e.g. 'unloaded') and empty changes dropped | Tabs.onUpdated |

### Verification
| command | exit | tail |
| npx vitest run src/messaging src/platform --coverage ... | 0 | 151 tests passed in 6 files; Lines 100% (406/406) |
| npm run typecheck | 0 | wxt prepare ok, tsc clean |
| npx eslint src/messaging src/platform --max-warnings 0 | 0 | clean |
| npm test | 0 | 38 files, 580 tests passed |

### Coverage
src/messaging + src/platform: Statements 100% (472/472), Branches 95.55%, Functions 100%, Lines 100% (406/406). tmp-cov-msg removed.

### Deviations
- Spec §5/§9: onUpdated emits the `change` info (status/url) per chrome.tabs.onUpdated, not the full tab; the url is present only when it changed. Status 'unloaded' is dropped since the requested type allows only loading|complete.

### Needs
none
