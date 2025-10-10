import { Plugin, PluginLifecycle } from '../plugin.js';
import { Context } from '../tool.js';
import tools from '../tools/index.js';

export default class NextJSPlugin extends Plugin implements PluginLifecycle {
  constructor(context: Context) {
    super('NextJSPlugin', context);
  }

  async detect(): Promise<boolean> {
    const t = tools(this.context);
    const pkgRaw = await t.readFile.execute({ path: 'package.json' }, {} as any);
    if (!pkgRaw) return false;
    let pkg: any;
    try {
      pkg = JSON.parse(pkgRaw);
    } catch {
      return false;
    }
    const version: string | undefined = pkg?.dependencies?.next || pkg?.devDependencies?.next;
    if (!version) return false;
    const cleanVersion = version.replace(/^[~^]/, '');
    console.log(`✅ Found Next.js ${cleanVersion}.`);
    return true;
  }

  async compile(): Promise<string> {
    const t = tools(this.context);

    // Read package.json (safe)
    let pkg: any = {};
    const pkgRaw = await t.readFile.execute({ path: 'package.json' }, {} as any);
    if (pkgRaw) {
      try {
        pkg = JSON.parse(pkgRaw);
      } catch {
        pkg = {};
      }
    }
    const version: string | undefined = pkg?.dependencies?.next || pkg?.devDependencies?.next;
    const cleanVersion = version ? version.replace(/^[~^]/, '') : 'unknown';

    // Get codebase tree
    let files: string[] = [];
    const treeRaw = await t.codebase.execute({}, {} as any);
    if (treeRaw) {
      try {
        files = JSON.parse(treeRaw);
        if (!Array.isArray(files)) files = [];
      } catch {
        files = [];
      }
    }

    const hasPrefix = (p: string) => files.some((f) => f.startsWith(p));
    const appDir = hasPrefix('app/');
    const pagesDir = hasPrefix('pages/');
    const routingMode = appDir && pagesDir ? 'both' : appDir ? 'app' : pagesDir ? 'pages' : 'unknown';

    // Config file detection priority
    const configCandidates = [
      'next.config.ts',
      'next.config.mjs',
      'next.config.js',
      'next.config.cjs',
    ];
    const configFile = configCandidates.find((c) => files.includes(c));

    // TypeScript detection
    const hasTsConfig = files.includes('tsconfig.json');
    const tsSource = files.some(
      (f) => (f.startsWith('app/') || f.startsWith('pages/')) && /\.tsx?$/.test(f) && !/\.d\.ts$/.test(f)
    );
    const usesTypeScript = hasTsConfig || tsSource;

    // Tailwind detection
    const tailwindConfig = files.find((f) => f.startsWith('tailwind.config.'));
    const tailwindDep = pkg?.dependencies?.tailwind || pkg?.devDependencies?.tailwind;
    const hasTailwind = !!tailwindConfig || !!tailwindDep;

    // Env files (root only)
    const envFiles = files.filter((f) => /^\.env(\..+)?$/.test(f) && !f.includes('/'));

    // Scripts
    const scripts = pkg?.scripts || {};
    const scriptNames = ['dev', 'build', 'start', 'lint'] as const;
    const scriptMarkers = scriptNames
      .map((n) => `${n}${scripts[n] ? '✓' : '✗'}`)
      .join(' ');

    // Build markdown table
    const tableLines = [
      '| Attribute | Value |',
      '| --------- | ----- |',
      `| Version | ${cleanVersion} |`,
      `| Routing | ${routingMode} |`,
      `| TypeScript | ${usesTypeScript ? 'yes' : 'no'} |`,
      `| Tailwind | ${hasTailwind ? 'yes' : 'no'} |`,
      `| Config File | ${configFile ?? 'none'} |`,
      `| Env Files | ${envFiles.length ? envFiles.join(', ') : 'none'} |`,
      `| Scripts | ${scriptMarkers} |`,
    ];

    const lines: string[] = [];
    lines.push('## Next.js');
    lines.push(`Detected Next.js ${cleanVersion} with ${routingMode} routing.`);
    lines.push('');
    lines.push(...tableLines);
    lines.push('');

    if (routingMode === 'both') {
      lines.push(
        '> Note: Both `app/` and `pages/` directories detected. This indicates a hybrid or migration state between routing systems.'
      );
    }

    const missingCore = scriptNames.filter((n) => !scripts[n] && ['dev', 'build', 'start'].includes(n));
    if (missingCore.length) {
      lines.push('');
      missingCore.forEach((s) => lines.push(`> Warning: Missing script: ${s}`));
    }

    if (!version) {
      lines.push('');
      lines.push('> Warning: Version could not be determined (package.json parsed without a next dependency version).');
    }

    return lines.join('\n').trim();
  }
}
