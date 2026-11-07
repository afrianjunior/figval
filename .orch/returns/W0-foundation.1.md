## Node Return — W0-foundation attempt 1
status: done

### Implemented graph
```ts
wxt build
  entrypoints/background.ts -> background/main.main()      (no-op)
  entrypoints/content.ts (registration: 'runtime') -> content/main.main()  (no-op)
  entrypoints/sidepanel/index.html -> main.tsx -> createRoot(#root).render(<div/>)
manifest(mode) = base + (mode === 'test' ? host_permissions:['<all_urls>'] : none)
hook build:manifestGenerated: non-test -> delete host_permissions (WXT auto-adds from runtime content matches)
```

### Files
| path | action | purpose |
|---|---|---|
| package.json, package-lock.json | created | pinned deps, scripts per §1 |
| wxt.config.ts | created | srcDir src, outDir .output, test-mode manifest, outDirTemplate |
| tsconfig.json, vitest.config.ts, playwright.config.ts, eslint.config.js, .prettierrc.json, .prettierignore, .gitignore | created | tooling |
| tests/setup.ts, tests/unit/placeholder.test.ts | created | jest-dom setup, placeholder test |
| tests/fixtures/{static,spa,hashed-classes,long-page}.html | created | fixtures |
| src/entrypoints/{background.ts,content.ts,sidepanel/index.html,sidepanel/main.tsx} | created | entry stubs |
| src/background/main.ts, src/content/main.ts | created | no-op main() |
| src/{domain,locator,markdown,storage,messaging,platform,background,content/picker,content/edit,content/markers,content/tooltip,sidepanel/model,sidepanel/ui,ui,copy}/index.ts | created | `export {};` barrels |
| .orch/returns/.gitkeep, tests/e2e/ | created | dirs |

### Exports
Barrels all `export {};`. background/main.ts and content/main.ts: `main — () => void — no-op`.

### Errors handled
| error tag | strategy | where |
|---|---|---|
| none | n/a | no domain logic |

### Verification
| command | exit | tail |
|---|---|---|
| npm run typecheck | 0 | wxt prepare + tsc --noEmit clean |
| npm run lint | 0 | eslint . --max-warnings 0 clean |
| npm test | 0 | 1 file, 1 test passed |
| npm run build | 0 | Built .output/chrome-mv3 (manifest, sidepanel.html, background.js, content-scripts/content.js) |
| npm run build:test | 0 | Built .output/chrome-mv3-test |

Production manifest: permissions sidePanel, activeTab, scripting, storage, unlimitedStorage, downloads; optional_host_permissions <all_urls>; action.default_title; commands.pick Alt+Shift+F; side_panel.default_path sidepanel.html; web_accessible_resources fonts/*, assets/* on <all_urls>; NO host_permissions.
Test manifest: same plus host_permissions ["<all_urls>"] (confirmed).

### Coverage
n/a

### Deviations
- §1 TypeScript: pinned typescript 5.9.3, not latest 7.0.2, because typescript-eslint 8.72.0 peer range is <6.1.0.
- Pins chosen as latest version >= 2 weeks old per npm time: wxt 0.21.4, react 19.1.10, effect 3.22.4 (v3), vitest 4.1.12, playwright 1.64.1, eslint 10.13.0, lucide-react 1.61.0, etc. Added @types/node 24.19.2.
- No @eslint/js or globals deps; typescript-eslint recommended covers the base rules.
- web_accessible_resources uses `fonts/*` and `assets/*` (WXT bundles @fontsource files under assets/); W-ui should confirm the real font path.
- WXT auto-adds host_permissions for runtime content script matches; removed in production via build:manifestGenerated hook to satisfy §9.
- Fixtures excluded from ESLint (HTML anyway).
- MISTAKE: I ran `prettier --write .` once, which reformatted p.impl.md (table padding; 51382 -> 64404 bytes, content equivalent) and it is included in the initial commit in that form. Original bytes are not recoverable from git. p.impl.prompt was unaffected (unknown extension). I added p.impl.md, p.impl.prompt, .orch to .prettierignore. Coordinator should restore p.impl.md from its own copy if exact bytes matter.
- Single commit e163063 on main (amended once to include fixes). Not pushed.

### Needs
none
