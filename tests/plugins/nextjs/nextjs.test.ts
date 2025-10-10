import { describe, it, expect, afterEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';

// Mock the tools module to bind our context-aware stubs every test
vi.mock('../src/tools/index.js', () => {
  return {
    default: (ctx: any) => {
      // ctx carries cwd; we read real filesystem from that cwd
      return {
        readFile: {
          execute: async ({ path }: { path: string }) => {
            try {
              return await (await import('node:fs/promises')).readFile(join(ctx.cwd, path), 'utf-8');
            } catch {
              return '';
            }
          },
        },
        codebase: {
          execute: async () => {
            // simple glob-less traversal: reuse buildPathTree logic would require import; for test brevity
            const { readdir, stat } = await import('node:fs/promises');
            const walk = async (dir: string, base = ''): Promise<string[]> => {
              const entries = await readdir(dir);
              const acc: string[] = [];
              for (const e of entries) {
                const full = join(dir, e);
                const rel = base ? `${base}/${e}` : e;
                const s = await stat(full);
                if (s.isDirectory()) {
                  acc.push(...(await walk(full, rel)));
                } else {
                  acc.push(rel);
                }
              }
              return acc;
            };
            const files = await walk(ctx.cwd);
            return JSON.stringify(files);
          },
        },
        writeFile: { execute: async () => '' },
      };
    },
  };
});

import NextJSPlugin from '../../../src/plugins/nextjs.js';
import { Context } from '../../../src/tool.js';

const makeTempDir = () => mkdtempSync(join(tmpdir(), 'ab-nextjs-'));

const writeFileTree = (root: string, files: Record<string, string>) => {
  for (const [p, content] of Object.entries(files)) {
    const full = join(root, p);
    const dir = full.split(sep).slice(0, -1).join(sep);
    if (dir) mkdirSync(dir, { recursive: true });
    writeFileSync(full, content, 'utf-8');
  }
};

describe('NextJSPlugin.detect', () => {
  it('returns false when package.json missing', async () => {
    const root = makeTempDir();
    const plugin = new NextJSPlugin({ cwd: root } as Context);
    const res = await plugin.detect();
    expect(res).toBe(false);
  });

  it('returns false when next dependency absent', async () => {
    const root = makeTempDir();
    writeFileTree(root, { 'package.json': JSON.stringify({ name: 'app' }) });
    const plugin = new NextJSPlugin({ cwd: root } as Context);
    const res = await plugin.detect();
    expect(res).toBe(false);
  });

  it('returns true when next in dependencies', async () => {
    const root = makeTempDir();
    writeFileTree(root, { 'package.json': JSON.stringify({ dependencies: { next: '^14.1.0' } }) });
    const plugin = new NextJSPlugin({ cwd: root } as Context);
    const res = await plugin.detect();
    expect(res).toBe(true);
  });

  it('returns true when next in devDependencies', async () => {
    const root = makeTempDir();
    writeFileTree(root, { 'package.json': JSON.stringify({ devDependencies: { next: '~14.0.0' } }) });
    const plugin = new NextJSPlugin({ cwd: root } as Context);
    const res = await plugin.detect();
    expect(res).toBe(true);
  });
});

describe('NextJSPlugin.compile', () => {
  const origCwd = process.cwd();
  afterEach(() => {
    process.chdir(origCwd);
  });

  it('produces markdown with combined routing and warnings', async () => {
    const root = makeTempDir();
    writeFileTree(root, {
      'package.json': JSON.stringify({
        dependencies: { next: '^14.2.0' },
        scripts: { dev: 'next dev', build: 'next build' },
      }),
      'app/page.tsx': 'export default function Page() {}',
      'pages/index.tsx': 'export default function Home() {}',
      'next.config.ts': 'export default {};',
      'tailwind.config.js': 'module.exports = {};',
      'tsconfig.json': '{}',
      '.env.local': 'VAR=1',
    });
    process.chdir(root); // needed because buildPathTree uses glob relative to process cwd
    const plugin = new NextJSPlugin({ cwd: root } as Context);
    expect(await plugin.detect()).toBe(true);
    const md = await plugin.compile();
    expect(md).toContain('## Next.js');
    expect(md).toContain('14.2.0');
    expect(md).toContain('both routing');
    expect(md).toContain('TypeScript | yes');
    expect(md).toContain('Tailwind | yes');
    expect(md).toContain('next.config.ts');
    expect(md).toMatch(/Env Files .*\.env.local/);
    expect(md).toMatch(/Scripts .*dev✓ build✓ start✗ lint✗/);
    expect(md).toContain('Warning: Missing script: start');
  });
});
