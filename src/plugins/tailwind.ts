import { glob } from 'glob';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Plugin, PluginLifecycle } from '../plugin.js';
import { Context } from '../tool.js';

/**
 * TailwindPlugin
 *
 * Detects Tailwind CSS usage inside the repository and produces a concise,
 * actionable Markdown summary suitable for inclusion in `AGENTS.md`.
 *
 * Detection Strategy
 * - Inspect `package.json` dependency fields for `tailwindcss`.
 * - When available, read `node_modules/tailwindcss/package.json` to obtain the
 *   installed, exact version.
 * - Look for common Tailwind configuration files in the project root:
 *   `tailwind.config.js`, `tailwind.config.cjs`, `tailwind.config.mjs`,
 *   `tailwind.config.ts`.
 * - Inspect PostCSS configuration files for references to `tailwindcss`.
 * - Scan CSS-like files for the `@tailwind` directive.
 *
 * Output Contract
 * - `detect()` returns `true` when Tailwind is detected by any strategy above.
 * - `compile()` returns a Markdown string containing a short summary that
 *   includes the detected version (if available), the evidence files, a
 *   trimmed copy of the Tailwind config (when present), and a short set of
 *   suggestions an AI agent can act on immediately.
 *
 * Example
 * const plugin = new TailwindPlugin({ cwd: process.cwd() });
 * const present = await plugin.detect();
 * if (present) {
 *   const md = await plugin.compile();
 *   // write AGENTS.md with the returned markdown
 * }
 */
export default class TailwindPlugin extends Plugin implements PluginLifecycle {
  constructor(context: Context) {
    super('TailwindPlugin', context);
  }

  /**
   * Scan the repository for Tailwind usage.
   *
   * The method performs multiple heuristics in order to be robust across
   * different setups and Tailwind versions:
   *
   * - Reads `package.json` and checks `dependencies`, `devDependencies`,
   *   `peerDependencies`, and `optionalDependencies` for the `tailwindcss`
   *   package name.
   * - Attempts to read `node_modules/tailwindcss/package.json` to retrieve the
   *   installed package version (preferred over the semver range in
   *   `package.json`).
   * - Checks for the presence of well-known Tailwind configuration file names
   *   at the repository root.
   * - Reads common PostCSS configuration files and looks for references to
   *   `tailwindcss` (e.g. `require('tailwindcss')`, `postcss([ require('tailwindcss') ])`).
   * - Scans CSS-like files for the `@tailwind` directive which is the most
   *   direct evidence of Tailwind usage in stylesheets.
   *
   * Returns `true` when any of the heuristics find evidence of Tailwind.
   */
  async detect(): Promise<boolean> {
    const cwd = (this.context && (this.context as any).cwd) || process.cwd();
    let found = false;
    let version: string | undefined;

    try {
      const pkgRaw = await readFile(join(cwd, 'package.json'), 'utf8');
      const pkg = JSON.parse(pkgRaw);
      const deps = Object.assign(
        {},
        pkg.dependencies || {},
        pkg.devDependencies || {},
        pkg.peerDependencies || {},
        pkg.optionalDependencies || {}
      );
      if (deps && typeof deps === 'object' && 'tailwindcss' in deps) {
        found = true;
        version = deps['tailwindcss'];
      }
    } catch (e) {}

    if (!version) {
      try {
        const nmRaw = await readFile(join(cwd, 'node_modules', 'tailwindcss', 'package.json'), 'utf8');
        const nmPkg = JSON.parse(nmRaw);
        if (nmPkg && nmPkg.version) {
          version = nmPkg.version;
          found = true;
        }
      } catch (e) {}
    }

    if (!found) {
      const configFiles = ['tailwind.config.js', 'tailwind.config.cjs', 'tailwind.config.mjs', 'tailwind.config.ts'];
      for (const f of configFiles) {
        try {
          await readFile(join(cwd, f), 'utf8');
          found = true;
          break;
        } catch (e) {}
      }
    }

    if (!found) {
      const postcssFiles = ['postcss.config.js', 'postcss.config.cjs', 'postcss.config.mjs', 'postcss.config.ts'];
      for (const f of postcssFiles) {
        try {
          const content = await readFile(join(cwd, f), 'utf8');
          if (
            content.includes('tailwindcss') ||
            content.includes("require('tailwindcss')") ||
            content.includes('require("tailwindcss")')
          ) {
            found = true;
            break;
          }
        } catch (e) {}
      }
    }

    if (!found) {
      try {
        const files = await glob('**/*.{css,pcss,postcss,scss,sass,less}', {
          cwd,
          nodir: true,
          ignore: ['node_modules/**', '.git/**', 'dist/**'],
        });
        const sample = files.slice(0, 200);
        for (const f of sample) {
          try {
            const content = await readFile(join(cwd, f), 'utf8');
            if (/@tailwind\b/.test(content)) {
              found = true;
              break;
            }
          } catch (e) {}
        }
      } catch (e) {}
    }

    if (found) {
      console.log(`✅ Found Tailwind CSS ${version || ''}.`);
      return true;
    }

    return false;
  }

  /**
   * Produce a concise Markdown summary for AGENTS.md describing Tailwind
   * usage in the repository.
   *
   * The returned markdown contains:
   * - A brief detection summary (version if known).
   * - The files that provided evidence for Tailwind usage (package.json,
   *   config files, PostCSS config, or CSS files containing `@tailwind`).
   * - A trimmed copy of the first-found Tailwind config file (if present).
   * - A short list of CSS/PCSS files that include the `@tailwind` directive.
   * - A few actionable suggestions an AI agent can follow (upgrade, where to
   *   look in the config for theme/plugin info, and how to add Tailwind
   *   plugins).
   *
   * The function is intentionally defensive about reading files: it will not
   * throw when files are missing and will trim large config outputs so the
   * resulting AGENTS.md remains focused and readable.
   */
  async compile(): Promise<string> {
    const cwd = (this.context && (this.context as any).cwd) || process.cwd();
    let detected = false;
    let version: string | undefined;
    const evidence: string[] = [];
    let configPath: string | undefined;
    let configContent: string | undefined;
    const cssFilesWithTailwind: string[] = [];

    try {
      const pkgRaw = await readFile(join(cwd, 'package.json'), 'utf8');
      const pkg = JSON.parse(pkgRaw);
      const deps = Object.assign(
        {},
        pkg.dependencies || {},
        pkg.devDependencies || {},
        pkg.peerDependencies || {},
        pkg.optionalDependencies || {}
      );
      if (deps && typeof deps === 'object' && 'tailwindcss' in deps) {
        detected = true;
        version = deps['tailwindcss'];
        evidence.push('package.json');
      }
    } catch (e) {}

    try {
      const nmRaw = await readFile(join(cwd, 'node_modules', 'tailwindcss', 'package.json'), 'utf8');
      const nmPkg = JSON.parse(nmRaw);
      if (nmPkg && nmPkg.version) {
        version = nmPkg.version;
        if (!evidence.includes('node_modules/tailwindcss')) evidence.push('node_modules/tailwindcss');
        detected = true;
      }
    } catch (e) {}

    const configCandidates = ['tailwind.config.js', 'tailwind.config.cjs', 'tailwind.config.mjs', 'tailwind.config.ts'];
    for (const f of configCandidates) {
      try {
        const content = await readFile(join(cwd, f), 'utf8');
        configPath = f;
        configContent = content;
        if (!evidence.includes(f)) evidence.push(f);
        detected = true;
        break;
      } catch (e) {}
    }

    const postcssCandidates = ['postcss.config.js', 'postcss.config.cjs', 'postcss.config.mjs', 'postcss.config.ts'];
    for (const f of postcssCandidates) {
      try {
        const content = await readFile(join(cwd, f), 'utf8');
        if (
          content.includes('tailwindcss') ||
          content.includes("require('tailwindcss')") ||
          content.includes('require("tailwindcss")')
        ) {
          if (!evidence.includes(f)) evidence.push(f);
          detected = true;
        }
      } catch (e) {}
    }

    try {
      const files = await glob('**/*.{css,pcss,postcss,scss,sass,less}', {
        cwd,
        nodir: true,
        ignore: ['node_modules/**', '.git/**', 'dist/**'],
      });
      for (const f of files.slice(0, 500)) {
        try {
          const content = await readFile(join(cwd, f), 'utf8');
          if (/@tailwind\b/.test(content)) {
            cssFilesWithTailwind.push(f);
            detected = true;
          }
        } catch (e) {}
      }
    } catch (e) {}

    if (!detected) {
      return '## Tailwind CSS\n\n- **Detected**: No\n';
    }

    const md: string[] = [];

    md.push('## Tailwind CSS');
    md.push('');
    md.push(`- **Detected**: Yes`);
    md.push(`- **Version**: \`${version || 'unknown'}\``);
    md.push(`- **Evidence**: ${evidence.length ? evidence.map((s) => `\`${s}\``).join(', ') : 'none'}`);
    md.push('');

    if (configPath && configContent) {
      const trimmed =
        configContent.length > 3200
          ? configContent.slice(0, 3200) + '\n\n/* config trimmed for brevity */'
          : configContent;
      md.push(`- **Tailwind config (first match)**: \`${configPath}\``);
      md.push('');
      md.push('```js');
      md.push(trimmed);
      md.push('```');
      md.push('');
      try {
        const contentMatch = configContent.match(/content\s*:\s*(\[[\s\S]*?\]|`[\s\S]*?`|\{[\s\S]*?\})/m);
        if (contentMatch) {
          const snippet = contentMatch[0].trim();
          md.push('- **Config notes**: Found a `content` configuration in the Tailwind config.');
          md.push('');
          md.push('```js');
          md.push(snippet);
          md.push('```');
          md.push('');
        }
      } catch (e) {}
    }

    if (cssFilesWithTailwind.length) {
      md.push('- **Stylesheets with `@tailwind` directives**:');
      md.push('');
      for (const f of cssFilesWithTailwind.slice(0, 25)) {
        md.push(`  - \`${f}\``);
      }
      if (cssFilesWithTailwind.length > 25) {
        md.push('  - `...and more`');
      }
      md.push('');
    }

    md.push('### Quick Suggestions');
    md.push('');
    md.push(
      '- To upgrade Tailwind to the latest version use `npm install -D tailwindcss@latest` or `yarn add -D tailwindcss@latest`.'
    );
    md.push(
      '- Inspect the `content` array in the Tailwind config to ensure all source directories that contain classes are included (e.g. `src/**/*.{js,ts,jsx,tsx,html}`)'
    );
    md.push(
      '- Look in the Tailwind config `theme.extend` and `plugins` to understand customizations and third-party plugins in use.'
    );
    md.push(
      '- If PostCSS integrates Tailwind, check `postcss.config.*` for the plugin ordering (Tailwind should typically be included before autoprefixer).'
    );
    md.push('');
    md.push('### How an AI Agent Can Help');
    md.push('');
    md.push('- Find unused utilities by scanning the `content` targets and suggest content path fixes.');
    md.push('- Migrate legacy Tailwind config keys to the current version (compare `version` with release notes).');
    md.push(
      '- Propose small theme changes (colors, spacing) by editing `theme.extend` and showing a before/after diff.'
    );
    md.push('');

    return md.join('\n').trim();
  }
}
