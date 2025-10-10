```markdown
# AgentBoost — AI Coding Agent Instructions

This guide enables AI coding agents to be immediately productive in the AgentBoost repo. It covers architecture, workflows, and project-specific conventions.

## Big Picture Architecture
- **AgentBoost** is a TypeScript CLI that loads ordered plugins and runs two lifecycle events: `detect` and `compile`.
- The CLI joins compiled plugin fragments and writes `AGENTS.md`.
- Plugins interact with the repo via lightweight tool wrappers (`src/tools/*`).
- ESM + NodeNext: `package.json` sets `type: "module"`; `tsconfig.json` uses `module: NodeNext`.

## Key Files & Structure
- `src/index.ts`: Core AgentBoost class, plugin registration, lifecycle emission.
- `src/plugin.ts`: Plugin base, `PluginLifecycle` interface (`detect()`, `compile()`).
- `src/plugins/*`: Concrete plugins. Registration order in `src/plugins/index.ts` defines execution sequence.
- `src/tools/*`: Exposed helpers (`codebase`, `readFile`, `writeFile`). Use: `const t = tools(this.context)`.
- `bin/agentboost`: CLI launcher; loads compiled JS from `dist/`.
- `prompt.md`: System prompt for LLM plugin (`big-picture`).

## Developer Workflows

**Terminal Management:** Always type `exit` after running terminal commands to properly close sessions and avoid lingering processes.
## Plugin Authoring
1. Implement `detect()` and `compile()` in `src/plugins/<name>.ts`.
2. Export plugin in `src/plugins/index.ts` (order matters).
3. **Create tests** following the structured pattern (see Testing section below).
4. Build: `npm run build` (required for CLI to load plugins).

## Testing Structure (Required Pattern)
When adding plugin tests, follow this exact structure:

**File Organization:**
- `tests/plugins/<plugin-name>/<plugin-name>.test.ts` — Main test file
- `tests/plugins/<plugin-name>/results/` — Expected output documentation

**Test Implementation Pattern:**
1. **Mock tools module** with filesystem-aware stubs:
   ```ts
   vi.mock('../../../src/tools/index.js', () => ({
     default: (ctx) => ({
       readFile: { execute: async ({path}) => /* read from ctx.cwd */ },
       codebase: { execute: async () => /* walk ctx.cwd directory */ },
       writeFile: { execute: async () => '' }
     })
   }));
   ```

2. **Use temporary directories** for isolated testing:
   ```ts
   const makeTempDir = () => mkdtempSync(join(tmpdir(), 'ab-plugin-'));
   const writeFileTree = (root, files) => { /* create file structure */ };
   ```

3. **Test both lifecycle methods:**
   - `detect()` tests: verify true/false logic with different dependency scenarios
   - `compile()` tests: assert markdown content contains expected sections/data

4. **Document expected outputs** in `results/` folder:
   - `<plugin>-detected-full-example.md` — comprehensive detection scenario
   - `<plugin>-detected-minimal.md` — basic detection scenario  
   - `<plugin>-not-detected.md` — explains no output when detection fails
   - Additional variants as needed (e.g., `<plugin>-detected-app-router.md`)

**Example Test Structure:**
```ts
describe('PluginName.detect', () => {
  it('returns false when package.json missing', async () => {
    const root = makeTempDir();
    const plugin = new PluginName({ cwd: root });
    expect(await plugin.detect()).toBe(false);
  });
  
  it('returns true when dependency present', async () => {
    const root = makeTempDir();
    writeFileTree(root, { 'package.json': JSON.stringify({deps: {framework: '^1.0.0'}}) });
    const plugin = new PluginName({ cwd: root });
    expect(await plugin.detect()).toBe(true);
  });
});

describe('PluginName.compile', () => {
  it('produces expected markdown structure', async () => {
    const root = makeTempDir();
    writeFileTree(root, { /* comprehensive file tree */ });
    process.chdir(root); // needed for glob operations
    const plugin = new PluginName({ cwd: root });
    const md = await plugin.compile();
    expect(md).toContain('## FrameworkName');
    expect(md).toContain('expected content');
  });
});
```

## Tool Contracts (Examples)
- `codebase.execute()`: Returns JSON string of file paths. Use `JSON.parse(tree)`.
- `readFile.execute({ path })`: Returns file content or `''` on error. Always guard before `JSON.parse`.
- `writeFile.execute({ path, content })`: Writes under `this.context.cwd`.

## CLI Argument Parsing
- `src/utils.ts` `parseArgs`: First non-flag token is command. Supports `key=value`, `--key value`, combined short flags (`-ab`), and bare flags (`true`).

## Integration Points
- LLM: `src/plugins/big-picture.ts` uses `openai('gpt-4o')` via `streamText`, passing `tools` for repo access. Uses `prompt.md`.
- File system: `glob` and `ignore` for repo tree (`src/utils.ts`).

## Project-Specific Conventions
- Plugins expect a `Context` object; tools bind to context.
- Tools and plugins pass plain strings/JSON; preserve shapes.
- Do not run TypeScript sources directly—always build to `dist`.
- `readFile.execute` returns `''` on failure—guard before parsing.

## Common Pitfalls
- **Terminal sessions:** Always type `exit` to close terminal sessions after running commands to prevent lingering processes.

## Example: Reading Files in Plugins
```ts
const t = tools(this.context);
const tree = await t.codebase.execute({}, {} as any);
const files = JSON.parse(tree);
const pkgRaw = await t.readFile.execute({ path: 'package.json' }, {} as any);
const pkg = pkgRaw ? JSON.parse(pkgRaw) : undefined;
```

---
If any section is unclear or incomplete, please provide feedback to iterate and improve these instructions.
```

## AgentBoost — quick agent instructions

This repo is a small TypeScript CLI that detects project structure and emits an `AGENTS.md` report using a plugin
lifecycle.

Key files

- `src/index.ts` - core `AgentBoost` class. Registers plugins and runs lifecycle events: `detect` then `compile`.
- `src/plugin.ts` - plugin base + `PluginLifecycle` interface (methods: `detect(): Promise<boolean>` and
  `compile(): Promise<string>`).
- `src/plugins/*` - concrete plugins (registered in `src/plugins/index.ts`) that implement detection and compilation
  logic.
- `src/tools/*` - tools exposed to plugins: `codebase`, `readFile`, `writeFile`. Plugins call these via
  `const t = tools(this.context)`.
- `bin/agentboost` - small launcher that registers compiled plugins from `dist/plugins` and invokes the CLI.
- `prompt.md` - prompt used by `BigPicture` plugin when calling the LLM.

How the system works (big picture)

- AgentBoost loads plugins (order defined in `src/plugins/index.ts`). For each lifecycle:
  - emit `detect`: each plugin's `detect()` runs and signals whether it applies.
  - emit `compile`: for detected plugins, `compile()` returns markdown fragments which are joined and written to
    `AGENTS.md`.
- Plugins interact with the repository via the lightweight tool wrappers in `src/tools`. Typical pattern:
  - `const t = tools(this.context)`
  - `const tree = await t.codebase.execute({}, {} as any)` (returns JSON string of file list)
  - `const file = await t.readFile.execute({ path: 'package.json' }, {} as any)`

Developer workflows (how to run / debug)

- Build compiled output (plugins are loaded from `dist` by the CLI):
  - npm run build
  - node ./bin/agentboost init
  - This generates `AGENTS.md` in the current working directory.
- Development loop (watch): `npm start` runs `tsc --watch` and emits JS into `dist/`.
- Note: `bin/agentboost` imports `../dist/*` so you must build the TypeScript to `dist` before running the CLI.

Project-specific conventions and patterns

- ESM + NodeNext: package.json sets `type: "module"` and `tsconfig` uses `module: NodeNext`.
- Plugins expect a `Context` object (provided when tools are constructed). Tools bind `execute` to the context via
  `src/tool.ts`.
- Tools return plain JS strings (often JSON strings). Common contract examples:
  - `codebase.execute()` -> returns JSON.stringify([...files]) (see `src/tools/codebase.ts`) — callers typically
    `JSON.parse` it.
  - `readFile.execute({ path })` -> returns file content or empty string on error (see `src/tools/read-file.ts`).
  - `writeFile.execute({ path, content })` -> writes relative to `this.context.cwd` and returns a success message.
- CLI argument parsing lives in `src/utils.ts` — `parseArgs` treats the first standalone non-flag token as `command` and
  supports `key=value`, `--key value`, combined short flags like `-ab`, etc. Use the same semantics if you synthesize
  CLI invocations.

Integration points & external deps

- LLM usage: `src/plugins/big-picture.ts` calls `streamText` / `openai('gpt-4o')` and passes `tools` into the LLM call.
  Expect `prompt.md` to be used as the system prompt.
- File system + glob: `glob` and `ignore` are used to build the repository tree (`src/utils.ts` -> `buildPathTree`). The
  `codebase` tool delegates to that.

Editing guidance for agents

- To add or update a plugin, edit `src/plugins/<name>.ts` and export it via `src/plugins/index.ts`. Then run
  `npm run build` so `bin/agentboost` can load it from `dist/plugins`.
- When reading files programmatically in plugins, prefer the `codebase` and `readFile` tools (mirrors how existing
  plugins gather data). Example from `NextJS` plugin:
  - `const tree = await t.codebase.execute({}, {} as any); const files = JSON.parse(tree) as string[];`
  - `const pkgRaw = await t.readFile.execute({ path: 'package.json' }, {} as any); const pkg = pkgRaw ? JSON.parse(pkgRaw) : undefined;`

Pitfalls to avoid (observed patterns)

- Don't assume `readFile` throws — it returns `''` on failure. Always guard/parse safely.
- Tools and plugins pass around plain strings/JSON; preserve exact shapes (e.g., `codebase` returns a JSON string
  array).
- The CLI binary imports compiled `dist` JS. Running source `.ts` directly will not work unless you build or add a
  runtime TypeScript loader.

If something is missing or unclear, tell me which file or flow you'd like expanded (examples: plugin lifecycle, a
specific plugin's expectations, or exact tool return shapes) and I will update these instructions.
