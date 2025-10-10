# Next.js Plugin Implementation Plan (AgentBoost)

Date: 2025-10-10

## Overview
Implement a robust Next.js plugin that detects Next.js usage, gathers framework characteristics (version, routing mode, TypeScript usage, config presence, scripts, env files), and produces a markdown fragment for `AGENTS.md`. Must leverage existing tool contracts (`codebase`, `readFile`) safely and handle partial setups gracefully.

## Requirements
1. Accurate detection: return true only if `package.json` has `dependencies.next` or `devDependencies.next`.
2. Enrich compile output with:
   - Version (raw string, e.g. `^14.1.0`) cleaned (strip leading `^`/`~` for display only)
   - Routing mode: `app`, `pages`, or `both`
   - TypeScript usage: presence of `tsconfig.json` or `.ts/.tsx` page/app files
   - Config file: detect first among `next.config.ts|mjs|js|cjs`
   - Tailwind presence: config file or dependency `tailwind`
   - Env files: list root `.env*`
   - Scripts: `dev`, `build`, `start`, `lint` (mark present/missing)
3. Compile returns a markdown section headed `## Next.js` with a concise table and any notes/warnings.
4. Fail-safe: detection returns false on unreadable/malformed `package.json` or missing dependency; compile guards all parsing.
5. Performance: single codebase traversal; limited file reads.
6. No external deps added; follow existing plugin style.

## Implementation Steps
1. Import `tools` in `nextjs.ts` (mirroring `big-picture.ts`).
2. `detect()`:
   - Read `package.json`; if missing/empty -> false.
   - Parse safely; check `dependencies.next || devDependencies.next`.
   - If missing -> false.
   - Extract version (raw) and log: `✅ Found Next.js <cleanVersion>.` where clean removes leading `^`/`~`.
   - Store parsed package (optional local variable reused in compile? Simplicity: re-read in compile).
3. `compile()`:
   - Get file list via `codebase.execute()` and parse to `files: string[]` (guard parse; fallback to []).
   - Re-read & parse `package.json` for version & scripts.
   - Derive attributes:
     - `appDir` = any path starts with `app/`.
     - `pagesDir` = any path starts with `pages/`.
     - `routingMode` = `both` if both present else one else `unknown` (should not happen if detected).
     - Config file: first found in priority order.
     - TypeScript: `files` has `tsconfig.json` OR any path under `app/` or `pages/` ending in `.ts` or `.tsx` (exclude `.d.ts`).
     - Tailwind: file starts with `tailwind.config.` or dependency name.
     - Env files: filter files that match `/^\.env(\..+)?$/` at root (no slashes).
     - Scripts presence map for `dev/build/start/lint`.
   - Build scripts markers: present -> name + `✓`, missing -> name + `✗`.
   - Build markdown table (pipe table) with attributes.
   - Append notes:
       - Dual routing note if `both`.
       - Missing core scripts warnings (build/dev/start).
   - Return trimmed markdown.
4. Guard all JSON.parse calls in try/catch.
5. Keep console output limited to detection log only.
6. Return empty string only in catastrophic scenario (should not happen); prefer minimal markdown even if partial data.

## Markdown Output Example (Target)
```
## Next.js
Detected Next.js 14.1.0 with app routing.

| Attribute    | Value                 |
| ------------ | --------------------- |
| Version      | 14.1.0                |
| Routing      | app                   |
| TypeScript   | yes                   |
| Tailwind     | no                    |
| Config File  | next.config.ts        |
| Env Files    | .env.local, .env.prod |
| Scripts      | dev✓ build✓ start✓ lint✗ |

> Warning: Missing script: lint
```

## Edge Cases & Fallbacks
- Malformed `package.json`: detect -> false.
- Both `app/` and `pages/`: mark routing `both` + explanatory note.
- No routing dirs found (unexpected): still compile but routing `unknown`.
- No config/env/scripts: display `none` or appropriate markers.
- Version string remains raw except stripping leading `^`/`~` for display.

## Testing Strategy (Future)
1. Detect success with dependency.
2. Detect failure without dependency.
3. Routing derivations: app-only, pages-only, both.
4. TypeScript detection via tsconfig & via file extension.
5. Config file priority order.
6. Tailwind detection via file & dependency.
7. Env file listing (multiple variants).
8. Scripts markers (present/missing).
9. Graceful handling of malformed package.json.

## Performance & Safety
- One codebase traversal only.
- O(1) scans using `some`/`find`/`filter` over file list.
- No dynamic imports or eval.
- All parsing guarded.

## Future Enhancements (Deferred)
- Summarize page/app route counts.
- Detect experimental flags in config.
- Include ESLint / Prettier integration notes.

```pseudo
// Simplified detection snippet
const pkgRaw = await t.readFile.execute({ path: 'package.json' }, {} as any);
if (!pkgRaw) return false;
let pkg; try { pkg = JSON.parse(pkgRaw); } catch { return false; }
const version = pkg.dependencies?.next || pkg.devDependencies?.next;
if (!version) return false;
console.log(`✅ Found Next.js ${version.replace(/^[~^]/,'')}.`);
return true;
```
