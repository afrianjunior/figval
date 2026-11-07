## Node Return — W4-tooltip-ui-fix2 attempt 1
status: done

### Implemented graph
```ts
// session.ts: ForkInScope = (Effect<void>) => void ; makeFork(scope) = runFork(Effect.forkIn(effect, scope))
// SessionCtx.fork: every save / cancel / textRow / draft write / draft clear / tab-update fiber runs through it
// actions.ts: closeScope = forkDaemon(Scope.close) |> join  (closing from inside a scope-owned fiber cannot self-wait)
// requestCancel / requestClose / startSave: no-op while store.saving; handle.cancel (programmatic) unchanged
```

### Files
| path | action | purpose |
|---|---|---|
| src/content/tooltip/session.ts | edit | ForkInScope, makeFork, ctx.fork |
| src/content/tooltip/actions.ts | edit | scoped forks, saving guard, requestCancel, closeScope |
| src/content/tooltip/view.tsx | edit | ctx.fork for text row / draft clear; onCancel = requestCancel |
| src/content/tooltip/drafts.ts | edit | makeDraftWriter takes fork; divergent comment |
| src/content/tooltip/controller.ts | edit | build fork from scope; tab update forked in scope |
| src/content/tooltip/boot.ts, matches.ts | edit | `// divergent:` on inline swallows |
| src/content/tooltip/controller.test.tsx | edit | new test: Cancel/Esc during save ignored, saved once |

### Exports
Actions gains `requestCancel`; makeDraftWriter gains 3rd param `fork`; SessionCtx gains `fork`. TooltipHandle / openSession unchanged.

### Errors handled
| error tag | strategy | where |
|---|---|---|
| save failure (RemoteFailure) | escape to store.saveFailed | actions.ts save |
| draft/storage errors | swallow with divergent comment | drafts.ts, boot.ts, matches.ts |

### Verification
| command | exit | tail |
|---|---|---|
| npx vitest run src/content/tooltip | 0 | 4 files passed, 65 tests passed |
| npx eslint src/content/tooltip --max-warnings 0 | 0 | no output |
| npx tsc --noEmit \| grep src/content/tooltip | - | no output |

### Coverage
n/a

### Deviations
Test strings already come from `copy` (t.actions.*, t.edit.controls.*); no literals. Test uses the Edit-tab hide checkbox to make the note dirty.

### Needs
none
