## Node Return — W2-messaging-platform-fix2 attempt 1
status: done

### Implemented graph
```ts
Handler = (req, ctx: HandlerContext{senderTabId?}) => Effect<unknown, HandlerError, never>
chrome onMessage(msg, sender) -> onRaw(msg, sender.id, sender.tab?.id) -> handleRaw -> runHandler(handler, req, ctx)
  live: runPromiseExit(onRaw) ; Failure -> sendResponse({ok:false,error:{tag:'InvariantViolation'}})
send(): retries = options.retries ?? (NON_IDEMPOTENT.has(tag) ? 0 : cfg.retries)
Download.markdown: tryPromise -> catch -> DownloadFailed({cause: string})
```

### Files
| path | action | purpose |
|---|---|---|
| src/messaging/transport.ts | edit | RawHandler gets optional 3rd arg senderTabId |
| src/messaging/messenger.ts | edit | HandlerContext, new Handler type, NON_IDEMPOTENT, retry default |
| src/messaging/live.ts | edit | pass sender.tab?.id; runPromiseExit + InvariantViolation envelope |
| src/messaging/loopback.ts | edit | LoopbackOptions.senderTabId |
| src/platform/download.ts | edit | DownloadFailed, typed error, DownloadTest(config) |
| src/platform/layers.ts | edit | PlatformTestConfig.download |
| src/platform/fake-chrome.ts | edit | senderTabId option (sender.tab.id) |
| src/messaging/messenger.test.ts, live.test.ts; src/platform/live.test.ts, test-layers.test.ts | edit | new tests |

### Exports
- `HandlerContext`, `Handler` (new signature), `NON_IDEMPOTENT: ReadonlySet<RequestTag>` from src/messaging.
- `LoopbackOptions.senderTabId?: number`.
- `RawHandler` now `(raw, senderId, senderTabId?)`.
- src/platform: `DownloadFailed` (TaggedError, `cause: string`), `DownloadTestConfig {fail?}`; `DownloadTest` is now a function `DownloadTest(config?)` (was a Layer constant; only used in layers.ts); `PlatformTestConfig.download`.

### Errors handled
| error tag | strategy | where |
|---|---|---|
| MessageTimeout | retry (0 for NON_IDEMPOTENT unless explicit retries) then escape | messenger.send |
| DownloadFailed | escape (typed) | platform/download.ts |
| raw handler rejection/defect | reply InvariantViolation envelope | messaging/live.ts |

### Verification
| command | exit | tail |
|---|---|---|
| npx vitest run src/messaging src/platform --coverage ... | 0 | 6 files, 158 tests passed |
| npx eslint src/messaging src/platform --max-warnings 0 | 0 | no output |
| npx tsc --noEmit \| grep src/(messaging\|platform)/ | - | no output |

### Coverage
Statements 100%, Branches 95.48%, Functions 100%, Lines 100% (both folders). Temp dir deleted.

### Deviations
- `DownloadTest` changed from a Layer to a config function to support the "can be configured to fail" requirement (matches ClipboardTest style).
- Added optional `senderTabId` to the RawHandler type and `makeFakeChrome` (needed to carry the tab id).
- Transport errors are still mapped to MessageTimeout (not changed; non-idempotent calls simply no longer retry).

### Needs
- Callers elsewhere that use `DownloadTest` as a constant must switch to `DownloadTest()` (none found outside src/platform; background/sidepanel should handle `DownloadFailed` in the error channel of `Download.markdown`).
