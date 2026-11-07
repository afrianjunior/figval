## Node Return — W2-messaging-platform attempt 1
status: done

### Implemented graph
```ts
Messenger (Context.Tag) = makeMessenger(Transport, {dev, timeoutMs=5000, retries=2})
  toBackground(req) | toContent(tabId, req)            // Effect, one-shot
    → Schema.encode(Request)                            // E: MessageDecodeError
    → Effect.suspend(transport.send(target, raw))       // chrome.runtime.sendMessage | chrome.tabs.sendMessage
        .pipe(mapError→MessageTimeout, timeoutFail(MessageTimeout), retry(Schedule.recurs(2)))   // retry ×2 then escape
    → Schema.decodeUnknown(replyEnvelope(replySchemas[tag]))   // E: MessageDecodeError
    → ok:false → RemoteFailure{tag,message}
    .pipe(catchTag MessageDecodeError → dev: Effect.die | prod: logWarning + fail)
  serve(side, handler)  // Scope: acquireRelease(chrome.runtime.onMessage listener)
    → sender.id === chrome.runtime.id else ignore → decode Request → direction check → handler(req)
    → encode replyEnvelope; handler E → {ok:false,error:{tag}}; defect → InvariantViolation reply
Transport: chromeTransport (MessengerLive) | loopback (in-process, JSON-cloned, per-side handlers)

Platform (all Context.Tag, chrome only inside Live layers via chromeApi())
  Tabs{get, queryActive, activeChanges: Stream, onRemoved: Stream}   Scripting{injectContent(tabId, ping?)}
  Permissions{ensureOrigin}  Capture{visibleTab, crop(rect×dpr→WebP)}  Clipboard{writeText, writeImage(WebP→PNG)}
  Download{markdown}  Clock{now}  Ids{noteId,shotId,sessionId}  SidePanel{setPanelBehavior,open}
  Commands{onCommand: Stream}  Action{onClicked: Stream}  unsupportedUrl(url)  cropRegion(rect,dpr,image)
```
```ts
Tests: MessengerLoopback / makeMessengerLoopback(opts) replace chromeTransport; PlatformTest(config) = TestRecorder + TestDriver
  + Tabs/Scripting/Permissions/Capture/Clipboard/Download/SidePanel/Commands/Action test layers + ClockFixed + IdsSequence.
  Graph shape identical; streams driven by TestDriver (PubSub); calls recorded in TestRecorder.
```

### Files
| path | action | purpose |
| src/messaging/protocol.ts | created | 22-request TaggedStruct union, replySchemas, ReplyValue, direction map, reply envelope |
| src/messaging/errors.ts | created | RemoteFailure{tag,message} |
| src/messaging/transport.ts | created | Transport interface (wire abstraction) |
| src/messaging/messenger.ts | created | Messenger tag + makeMessenger (encode/decode, timeout, retry, serve, sender check) |
| src/messaging/loopback.ts | created | MessengerLoopback, makeMessengerLoopback, makeLoopbackTransport |
| src/messaging/live.ts | created | chromeTransport, MessengerLive |
| src/messaging/fixtures.ts | created | test fixtures (Note, draft, sample requests/replies) |
| src/messaging/{protocol,messenger,live}.test.ts | created | 77 tests |
| src/messaging/index.ts | modified | barrel |
| src/platform/{types,unsupported-url,capture-math,chrome-api,image}.ts | created | pure helpers, chrome accessor, canvas/WebP helpers |
| src/platform/{tabs,scripting,permissions,capture,clipboard,download,clock,ids,side-panel,commands,action}.ts | created | Tag + Live + Test layer per service |
| src/platform/{test-driver,layers}.ts | created | TestRecorder/TestDriver; PlatformLive, PlatformTest |
| src/platform/fake-chrome.ts | created | minimal fake `chrome` for Live-layer tests |
| src/platform/{pure,test-layers,live}.test.ts | created | 68 tests |
| src/platform/index.ts | modified | barrel |
| .orch/returns/W2-messaging-platform.1.md | created | this return |

### Exports
messaging barrel: Request (schema+type), RequestTag, replySchemas, ReplyValue<R>, ContentRequest/BackgroundRequest/ContentTag/contentTags, directionOf(tag), Direction, Reply<A>, ReplyError, replyEnvelope(schema), replySchemaFor(tag), SettingsPatch, ActivateVia, per-message schemas (PickerStart…ActivateTab); RemoteFailure; Messenger (Tag), MessengerService, makeMessenger(transport, cfg?), Handler, HandlerError, CallOptions{timeoutMs,retries}, MessagingError, Transport/Side/SendTarget/RawHandler; MessengerLive; MessengerLoopback; makeMessengerLoopback(opts); makeLoopbackTransport(opts).
platform barrel: TabInfo, Rect; unsupportedUrl(url)=>boolean; cropRegion(rect,dpr,image)=>{sx,sy,sw,sh}; chromeApi(); fixedWebp(); tags Tabs, Scripting, Permissions, Capture, Clipboard, Download, Clock, Ids, SidePanel, Commands, Action; *Live layers; test layers TabsTest, ScriptingTest(cfg), PermissionsTest(cfg), CaptureTest(cfg), ClipboardTest(cfg), DownloadTest, ClockFixed(ms), IdsSequence, SidePanelTest, CommandsTest, ActionTest; TestRecorder/TestRecorderLive, TestDriver/TestDriverLive; PlatformLive; PlatformTest(config).

### Errors handled
| error tag | strategy | where |
| MessageTimeout | retry ×2 (Schedule.recurs(2), per-call override) then escape; transport rejection (e.g. sleeping SW) also mapped to it | Messenger.call |
| MessageDecodeError | die if dev, else logWarning + escape (client); error reply (server) | Messenger.call / serve |
| RemoteFailure | escape (carries remote tag) | Messenger.call |
| handler defects | converted to {ok:false, tag:'InvariantViolation'} reply + logError | serve |
| UnsupportedPage | escape (Tabs.get on unreadable tab) | Tabs |
| InjectionFailed | escape (retry ×1 300ms left to Activation in background per §6) | Scripting |
| PermissionDenied | escape | Permissions |
| CaptureFailed | escape | Capture |
| ClipboardDenied | escape | Clipboard |

### Verification
| command | exit | tail |
| npx vitest run src/messaging src/platform --coverage --coverage.include='src/messaging/**' --coverage.include='src/platform/**' | 0 | Test Files 6 passed; Tests 145 passed; Statements 100% (455/455), Branches 95.12%, Functions 100%, Lines 100% (391/391) |
| npm run typecheck | 0 | wxt prepare ok, tsc --noEmit clean |
| npm run lint | 0 | eslint . --max-warnings 0 clean |

### Coverage
src/messaging + src/platform: Lines 100% (391/391), Statements 100%, Functions 100%, Branches 95.12%. Live layers are covered through a fake `chrome` global and stubbed OffscreenCanvas/createImageBitmap/ClipboardItem, so nothing is excluded.

### Deviations
- §8/checklist 1: reply value for void messages travels as `null` (JSON drops undefined) and decodes to `undefined`. Ping replies `{pong:true}`; SessionActivate and SettingsUpdate reply Settings; NoteCreate/NoteUpdate reply Note; SessionCreate/SessionRename reply Session. No extra messages added.
- checklist 2: Messenger methods take an optional third/second `CallOptions {timeoutMs, retries}` so the activation ping can use a short timeout with no retries (default ping would otherwise cost 3×5 s). `serve(side, handler)` takes the side.
- MessageTimeout: a transport rejection (no receiver, SW asleep) is mapped to MessageTimeout{ms:0} so the retry wakes the worker.
- Scripting: file path is '/content-scripts/content.js' (leading slash) because WXT's typed `ScriptPublicPath` rejects the bare form; Chrome accepts both. `injectContent(tabId, ping?)` takes the ping effect as spec allows; the InjectionFailed 300 ms retry stays with the background activation.
- Tabs.get on a missing/unreadable tab fails with UnsupportedPage{url:''} (no domain error fits). Action.onClicked emits TabInfo (not raw chrome Tab); tabs with no id are dropped. Download.markdown and SidePanel failures are defects (Effect.orDie): no domain error exists for them. Download uses a data URL (no URL.createObjectURL in MV3 SW) with saveAs true.
- unsupportedUrl: PDF choice = chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/ (via chrome-extension: rule) plus any URL whose path ends in `.pdf`; also rejects chrome-untrusted:, devtools:, about:, chrome.google.com/webstore. Empty/unparsable URL returns false.
- No global `chrome` types exist in the repo, so `chromeApi()` returns WxtBrowser typed from 'wxt/browser' and reads `globalThis.chrome` lazily.
- Test layers share one `TestRecorder` (calls log) and `TestDriver` (tab/command/action events) instead of per-service recorder tags. `src/platform/fake-chrome.ts` and `src/messaging/fixtures.ts` are test support living in src and are imported across my two folders (messaging tests import ../platform/fake-chrome).
- Stream-driven test layers (PubSub) only deliver to already-subscribed consumers; tests must let the consumer fork settle before publishing.

### Needs
none
