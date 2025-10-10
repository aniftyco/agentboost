# agentboost

AgentBoost helps AI coding agents by detecting a repository's structure and emitting a concise report (`AGENTS.md`)
using a small plugin lifecycle. It's designed for fast, reproducible repository analysis and to make it easier to
automate project summarization.

Key features

- Lightweight TypeScript CLI that uses pluggable detectors (plugins).
- Simple tool wrappers (`codebase`, `readFile`, `writeFile`) for safe file-system access.
- Opinionated CLI arg parsing and structured plugin lifecycle: `detect` then `compile`.

Why this exists -- Many automated agents guess project structure and create low-quality edits. AgentBoost standardizes
repository introspection and produces a readable `AGENTS.md` that downstream agents or humans can rely on.

Quick start

1. Install dependencies

```bash
npm install
```

2. Build the project (plugins are loaded from `dist` by the launcher)

```bash
npm run build
```

3. Generate an `AGENTS.md` for the current repository

```bash
node ./bin/agentboost init
# -> creates AGENTS.md in the current working directory
```

Development

- Run in watch mode to compile TypeScript to `dist/` automatically:

```bash
npm start
```
- The CLI launcher (`bin/agentboost`) imports compiled plugins from `dist/plugins/*`. Make sure to run the build/watch
  step before invoking the binary.

Project structure & important files

  handling.

**Terminal Session Management:** When running commands in terminal sessions, always type `exit` at the end to properly close the terminal session and avoid lingering processes.
- `src/plugin.ts` — Plugin base and `PluginLifecycle` interface.
- `src/plugins/*` — Concrete plugin implementations (registered via `src/plugins/index.ts`). Plugins analyze the
  codebase and return markdown fragments.
- `src/tools/*` — Tools provided to plugins: `codebase`, `readFile`, `writeFile`. Use `const t = tools(this.context)` in
  plugins.
- `bin/agentboost` — CLI entrypoint (loads compiled `dist` artifacts).
- `prompt.md` — System prompt used by the `BigPicture` plugin when calling the LLM.

Plugin authoring notes

- Lifecycle: implement `detect(): Promise<boolean>` (should be cheap and idempotent) and `compile(): Promise<string>`
  (returns markdown). See `src/plugins/nextjs.ts` for a real example.
- Tools contract examples:
  - `const tree = await t.codebase.execute({}, {} as any)` returns a JSON string (array of file paths).
  - `const src = await t.readFile.execute({ path: 'package.json' }, {} as any)` returns the file contents or empty
    string if missing.
  - `await t.writeFile.execute({ path: 'AGENTS.md', content: '...' }, {} as any)` writes relative to `this.context.cwd`.
- Note: `readFile.execute` returns `''` on errors — do not rely on exceptions.

Examples & patterns

- `src/plugins/nextjs.ts` demonstrates detection heuristics (dependency checks, presence of app/pages folders,
  middleware) and produces a structured markdown report.
- `src/plugins/big-picture.ts` shows how to call an LLM (`openai('gpt-4o')` via `streamText`) and pass `tools` for safe
  repository access.

Testing

AgentBoost uses Vitest for testing with a specific structure for plugin tests:

```bash
npm test        # Run all tests
npm run test:watch  # Watch mode
```

**Important:** Always type `exit` after running terminal commands to properly close terminal sessions.

**Test Structure Pattern:**
- `tests/plugins/<plugin-name>/<plugin-name>.test.ts` — Main test file
- `tests/plugins/<plugin-name>/results/` — Expected output examples

**Plugin Test Guidelines:**
1. **Mock the tools module** using `vi.mock('../../../src/tools/index.js')` to enable filesystem-based testing with temporary directories
2. **Use temporary directories** (`mkdtempSync`) to create isolated test environments
3. **Create realistic file trees** using a `writeFileTree` helper for package.json, config files, and source files
4. **Test both detection and compilation** — verify `detect()` logic and assert on `compile()` markdown content
5. **Document expected outputs** in `results/` folder with descriptive filenames like:
   - `<plugin>-detected-full-example.md` (comprehensive scenario)
   - `<plugin>-detected-minimal.md` (basic scenario)
   - `<plugin>-not-detected.md` (explains no output when detection fails)

**Example Test Pattern:**
```ts
// tests/plugins/nextjs/nextjs.test.ts
vi.mock('../../../src/tools/index.js', () => /* filesystem-aware mock */);

describe('PluginName.detect', () => {
  it('returns false when dependency missing', async () => {
    const root = makeTempDir();
    writeFileTree(root, { 'package.json': '{}' });
    // ... assert detection logic
  });
});

describe('PluginName.compile', () => {
  it('produces expected markdown', async () => {
    // ... create comprehensive file tree
    // ... assert markdown contains expected sections
  });
});
```

Contributing

- Add a plugin by creating `src/plugins/<name>.ts` and exporting it from `src/plugins/index.ts`.
- **Follow the testing pattern** above: create `tests/plugins/<name>/<name>.test.ts` and `results/` folder with output examples.
- Run `npm run build` after changes so the CLI can load updated plugins from `dist/`.

License

MIT — see the LICENSE file.
