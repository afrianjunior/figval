## Node Return — W3-content-core-fix2 attempt 1
status: done

### Implemented graph
```ts
render(notes) -> findElement per note -> mount pins -> report(missing)   // report now ALWAYS sent after a render, ids may be []
place(entry) -> slot.style.transform + slot.dataset.edge = ['right' if x > w-220, 'below' if y < 40].join(' ')
writeHover -> store.set(...).pipe(Effect.ignore)   // now annotated `// divergent:`
```

### Files
| path | action | purpose |
| src/content/markers/markers.ts | edit | F11 always report (report only runs from render, so never before first render); F7 divergent comment; UI-5 data-edge |
| src/content/markers/markers.test.ts | edit | tests: empty MissingReport after later empty render; data-edge right/below and cleared |

### Exports
No API change.

### Errors handled
| error tag | strategy | where |
| MessengerError (MissingReport send) | escape (logWarning, forkDaemon) | markers.report |
| SessionStore.set failure | divergent ignore | markers.writeHover |

### Verification
| command | exit | tail |
| npx vitest run src/content/picker src/content/markers | 0 | 4 files, 32 tests passed |
| npx eslint src/content/picker src/content/markers src/content/main.ts --max-warnings 0 | 0 | clean |
| npx tsc --noEmit \| grep -E "src/content/(picker\|markers\|main)" | - | prints nothing |

### Coverage
n/a

### Deviations
- main.ts Handler: the Handler type is now (req, ctx) in src/messaging. main.ts's 1-arg handler is type-compatible and ctx is unused, so left as is (an explicit `_ctx` trips no-unused-vars). No test in my folders called a handler directly, so no test change.
- No other inline swallows exist in picker/markers/main.

### Needs
- src/content/tooltip/controller.test.tsx "ignores Cancel and Esc while a save is in flight..." currently fails ("Expected an element or document but got ShadowRoot"); outside my folders, not caused by my changes.
