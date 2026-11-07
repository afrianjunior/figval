## Node Return — W1-copy-fix1 attempt 1
status: done

### Implemented graph
```ts
markdownHuman.pageUrl(url) -> `**Page:** ${url}`
```

### Files
| path | action | purpose |
|---|---|---|
| src/copy/human.ts | modified | added `pageUrl` to `markdownHuman` |
| src/copy/strings.test.ts | modified | unit test for `pageUrl` |

### Exports
markdownHuman.pageUrl — (url: string) => string — labeled single-page URL line for the human meta line.

### Errors handled
| error tag | strategy | where |
|---|---|---|
| none | n/a | n/a |

### Verification
| command | exit | tail |
|---|---|---|
| npx vitest run src/copy | 0 | Test Files 3 passed (3); Tests 13 passed (13) |
| npx tsc --noEmit | 0 | no output |

### Coverage
n/a

### Deviations
none. Wording `**Page:** <url>` matches the `**Date:**` / `**Pages:**` label style; no humanizer/antislop tells in it. The test was written before the code but the first red run used the wrong cwd (no tests found), so a true failing run was not captured.

### Needs
none
