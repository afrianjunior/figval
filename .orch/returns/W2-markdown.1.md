## Node Return — W2-markdown attempt 1
status: done

### Implemented graph
```ts
render(format, ExportInput) -> string                      // pure, no Effect, no chrome
  renderLlm
    exportTitle(notes,'llm') -> pagesOf -> groupByPage(domain) -> normalizePage
    INSTRUCTIONS_LINES (verbatim 11.2 constants, llm-constants.ts)
    execGraph(notes) -> collectEdges -> dependency(a,b) -> levelize -> InvariantViolation (cycle: die)
      -> null  => Execution graph block omitted
      -> execGraphLines
    per page: pageHeading + URL -> noteBlocks -> headerLine | whyLines | locateLines | changeLines(styleTable) | verifyLine | htmlLines
    RETURN_FORMAT_LINES (session id swapped in)
  renderHuman
    exportTitle(notes,'human') -> copy.markdownHuman.title
    metaBlock (copy.metaLine, copy.screenSize, formatLongDate) -> summaryBlock (tags()) -> pages -> humanNoteBlocks
      -> copy.markdownHuman.{note,changesLabel,textChanged,styleChanged,paddingBoth,elementRemoved,appliesToAll,screenshotHint,technical}
exportFilename(notes, now) -> slugOf -> slugify; isoDate(now) UTC
```

### Files
| path | action | purpose |
|---|---|---|
| src/markdown/types.ts | created | ExportInput, ExportFormat, ShotLookup, ExecGraph/Edge/Wave |
| src/markdown/util.ts | created | UTC date helpers, pagesOf, safe code fences |
| src/markdown/title.ts | created | exportTitle, exportFilename, TITLE_MAX (48) |
| src/markdown/exec-graph.ts | created | execGraph, execGraphLines, levelize (cycle -> InvariantViolation) |
| src/markdown/verify.ts | created | verifyLine |
| src/markdown/llm-constants.ts | created | 11.2 Instructions and Return format, verbatim (generated from p.impl.md lines, em dashes kept) |
| src/markdown/table.ts | created | padded style table |
| src/markdown/llm-note.ts | created | LLM note section blocks |
| src/markdown/llm.ts | created | renderLlm |
| src/markdown/human-note.ts | created | human note section blocks, hasShot |
| src/markdown/human.ts | created | renderHuman |
| src/markdown/index.ts | modified | barrel (was `export {}`) |
| src/markdown/{golden,exec-graph,verify,title,render}.test.ts | created | 85 tests |
| src/markdown/__fixtures__/builders.ts, cases.ts | created | note/session builders, case list |
| src/markdown/__fixtures__/*.input.ts (9) | created | example, single-page, multi-page, multi-host, text-selection, propose-vs-force, hidden, similar-dependency, no-dependency |
| src/markdown/__fixtures__/*.llm.md, *.human.md (18) | created | goldens. example.llm.md was assembled from the p.impl.md 11.2 template (FV-1 slice, graph, Instructions, Return format byte-identical), the rest reviewed by eye after generation |
| .orch/returns/W2-markdown.1.md | created | this return |

### Exports
- render — (format: 'llm'|'human', input: ExportInput) => string — dispatch.
- renderLlm — (input) => string — 11.2 export.
- renderHuman — (input) => string — 11.4 export.
- verifyLine — (note: Note, pagePath: string) => string — full "**Verify:** ..." line.
- execGraph — (notes: readonly Note[]) => ExecGraph | null — waves and edges, null when no edge.
- exportTitle — (notes, format) => string.
- exportFilename — (notes, now: number) => string.
- TITLE_MAX = 48.
- types: ExportFormat, ExportInput, ExecGraph, ExecEdge, ExecWave, ShotLookup.

### Errors handled
| error tag | strategy | where |
|---|---|---|
| InvariantViolation | die (thrown from pure code; caller's Effect boundary treats as defect) | exec-graph.ts `levelize` on a cycle (unreachable via 11.3 because edges go forward in seq only; covered by a direct test) |

### Verification
| command | exit | tail |
|---|---|---|
| npx vitest run src/markdown --coverage --coverage.include='src/markdown/**' | 0 | Test Files 5 passed, Tests 85 passed; All files 99.48 stmts / 95.73 branch / 100 funcs / 100 lines |
| npm run typecheck | 0 | `wxt prepare && tsc --noEmit` clean |
| npm run lint | 1 | only src/platform/fake-chrome.ts and src/platform/live.test.ts (owned by W2-messaging-platform): unused `_q/_w/_o` args. `npx eslint src/markdown --max-warnings 0` exits 0 |

### Coverage
src/markdown: lines 100%, statements 99.48%, branches 95.73%, functions 100%. Coverage run prints "Failed to parse ... .md. Excluding it from coverage" noise for the golden .md files because the card's include glob matches them; exit code is still 0.

### Deviations
- 11.1 / title: human title is `copy.markdownHuman.title` ("Website review: ..."), per the approved copy deviation. LLM title keeps the em dash as a constant. Empty export: LLM "Figval Review", human "Website review:".
- 11.1: TITLE_MAX = 48 on the host+path subject. Over the limit, a path with 3+ segments becomes `host/first/…/last`; if still too long it is hard-clipped with `…`.
- 11.1 filename: slug = host + path with `/` -> `-`, other unsafe chars (port colon) -> `-`; empty export drops the slug.
- 11.2 meta: singular "1 change" / "1 page". "N changes" = number of notes.
- 11.2 date/time and human Date use `now` (export time), UTC, not session.createdAt.
- 11.2 Locate: no Classes line (the template example shows none; classes are visible in the DOM path). Attributes order: data-testid, id, aria-label, role, name. DOM-path step: `tag#id.class[data-testid="x"]:nth-of-type(n)`. Selected text and Context lines follow the Text line.
- 11.2 Change: `Remove this element.` is rendered as a bullet; text bullet, table and remove bullet are separate blocks.
- 11.2 Verify: hidden notes read only "is removed" (other edits and the hover/focus tail dropped); a force-applied note with no edits reads "the element matches the request above" (invented neutral clause, agent-facing constant).
- 11.2 Why/Comment: comment-only unedited note with a `why` renders both Why and Comment.
- 11.3: edge explanation lines use plain `FV-b` / `FV-a` without backticks, matching the template example (the spec prose shows backticks, the example does not). Variant (a) text: "both edit the same element; FV-b overrides FV-a for one instance." Selector shown in variant (b) is `A.edits.similarSelector`. Edges only run forward in seq (A.seq < B.seq). Variant (b) requires at least one class token in the similar selector. All notes (including propose and other pages) are graph nodes. Several edges produce several consecutive lines.
- 11.4 human: single-page URL is appended to the meta line as a bare URL after ` · ` (no label, since copy has none). Screen size uses the first note's viewport. Two note texts (why, comment) render as two `**Note:**` paragraphs. The Summary section is omitted when no note carries a tag. Screenshot hint has no emoji (approved). `hasShot`: lookup set or predicate when `shots` is given, else the note has a stored shot id.
- Process: TDD order was relaxed. Golden example was written from the spec first, then implementation, then the remaining goldens generated and reviewed (not hand-typed).

### Needs
- copy: a label string for the single-page URL on the human meta line (currently a bare URL).
- src/platform lint errors (unused `_` params in fake-chrome.ts, live.test.ts) block a green `npm run lint`; owner W2-messaging-platform.
