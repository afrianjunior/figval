## Node Return — W2-markdown-fix1 attempt 2
status: done

### Implemented graph
```ts
render(format, ExportInput) -> string
  renderLlm
    exportTitle -> pagesOf -> INSTRUCTIONS_LINES (no blank after Apply / When it breaks / Boundaries)
    execGraph -> execGraphLines: fence, wave line, fence, edge lines (no blank between)
    per page: [pageHeading, URL] -> noteBlocks:
      [### heading, header tag line] | why | Locate (label then bullets) | Change (label, bullets, blank, table) | verifyLine | HTML (label, fence)
    styleTable: '| Property | Before | After |', '|---|---|---|', unpadded rows
  renderHuman
    meta block: metaLine, screenSize, copy.markdownHuman.pageUrl(url) (single page only)
    Summary block: heading + bullets in one block
    humanNoteBlocks: [### n. label, first content line] ... Changes label + bullets, screenshot hint, details (no blank before </details>)
```

### Files
| path | action | purpose |
|---|---|---|
| src/markdown/llm-constants.ts | modified | drop blank lines after bold labels |
| src/markdown/table.ts | modified | unpadded table, `\|---\|---\|---\|` separator |
| src/markdown/llm-note.ts | modified | tight heading/header, Locate, Change, HTML layout |
| src/markdown/llm.ts | modified | page heading and URL on adjacent lines |
| src/markdown/exec-graph.ts | modified | no blank between closing fence and edge lines |
| src/markdown/human.ts | modified | Summary heading attached; pageUrl line |
| src/markdown/human-note.ts | modified | heading attached to first line; Changes label tight; no blank before </details> |
| src/markdown/golden.test.ts | modified | layout guard tests (exact substrings) |
| src/markdown/exec-graph.test.ts, render.test.ts | modified | updated for new layout |
| src/markdown/__fixtures__/*.llm.md, *.human.md (18) | modified | regenerated, reviewed against templates |

### Exports
Unchanged: render, renderLlm, renderHuman, verifyLine, execGraph, exportTitle, exportFilename, TITLE_MAX, types.

### Errors handled
| error tag | strategy | where |
|---|---|---|
| InvariantViolation | die | exec-graph.ts levelize (cycle) |

### Verification
| command | exit | tail |
|---|---|---|
| npx vitest run src/markdown --coverage --coverage.include='src/markdown/**' | 0 | 5 files, 87 tests passed; Stmts 99.47, Branch 96.66, Funcs 100, Lines 100 |
| npm run typecheck | 0 | wxt prepare clean, tsc no errors |
| npx eslint src/markdown --max-warnings 0 | 0 | no output |

### Coverage
src/markdown: lines 100%, statements 99.47%, branches 96.66%, functions 100%.

### Deviations
- Previous deviations kept except: human single-page URL now its own line via copy.markdownHuman.pageUrl (renders `**Page:** <url>`), after the screen size line.
- 11.2 Change: when both a text edit and a hide exist, both bullets sit together under `**Change**`, then a blank line, then the table (previously the Remove bullet came after the table).
- Human: with no `**Note:**` line, the `### n.` heading attaches to the next first line (Changes or details).
- Human: details block with no html ends `- ...` then `</details>` with no blank line (matches template with html).
- Goldens generated through a temporary vitest script (deleted); Prettier not run.

### Needs
none
