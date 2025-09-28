import { openai } from '@ai-sdk/openai';
import { stepCountIs, streamText, tool } from 'ai';
import { readdirSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { Plugin, PluginLifecycle } from './plugin.js';
import { parseArgs, buildPathTree } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export type LifeCycleEvent = 'detect' | 'compile';

export class AgentBoost {
  private plugins = new Map<string, PluginLifecycle>();
  private detected = new Set<string>();

  constructor(public readonly cwd: string) {}

  async register(dir: string): Promise<void>;
  async register(PluginClass: Plugin): Promise<void>;
  async register(arg: string | Plugin): Promise<void> {
    if (typeof arg === 'string') {
      const dir = join(__dirname, arg);
      const plugins = await Promise.all(
        readdirSync(dir).map((file) => import(join(dir, file)).then((mod) => mod.default))
      );
      for (const plugin of plugins) {
        this.register(plugin);
      }
    } else {
      const plugin = new (arg as any)({ cwd: this.cwd });
      this.plugins.set(plugin.name, plugin);
    }
  }

  async emit(event: LifeCycleEvent): Promise<void> {
    switch (event) {
      case 'detect': {
        for (const plugin of this.plugins.values()) {
          if (!this.detected.has(plugin.name) && (await plugin.detect())) {
            this.detected.add(plugin.name);
          }
        }
        break;
      }
      case 'compile': {
        const compiled: string[] = [];

        for (const pluginName of this.detected) {
          const plugin = this.plugins.get(pluginName);
          if (plugin) {
            compiled.push(await plugin.compile());
          }
        }
        break;
      }
      default: {
        throw new Error(`Unknown event: ${event}`);
      }
    }
  }

  async getPrompt(): Promise<string> {
    return readFile(join(__dirname, '../prompt.md'), 'utf-8');
  }

  async run(argv: string[]): Promise<void> {
    const { command = 'init', params } = parseArgs(argv);

    await this.emit('detect');

    console.log('Detected plugins:', Array.from(this.detected).join(', ') || 'None');

    // const { textStream } = streamText({
    //   model: openai('gpt-4o'),
    //   prompt: await this.getPrompt(),
    //   stopWhen: stepCountIs(10),
    //   tools: {
    //     codebase: tool({
    //       description: 'Get the source code tree starting from the current working directory',
    //       inputSchema: z.object({
    //         path: z.string().optional().describe('The directory path relative to the project root'),
    //       }),
    //       outputSchema: z.string().describe('A JSON representation of the source code tree'),
    //       execute: (async ({ path }) => {
    //         const tree = await buildPathTree(path ? join(path, this.cwd) : this.cwd);
    //         return JSON.stringify(tree, null, 2);
    //       }).bind(this),
    //     }),
    //     read: tool({
    //       description: 'Read a file',
    //       inputSchema: z.object({
    //         path: z.string().describe('The file path relative to the project root'),
    //       }),
    //       outputSchema: z.string().describe('The UTF-8 text content of the file'),
    //       execute: (async ({ path }) => {
    //         try {
    //           return await readFile(`${this.cwd}/${path}`, 'utf-8');
    //         } catch (e) {
    //           return '';
    //         }
    //       }).bind(this),
    //     }),
    //     write: tool({
    //       description: 'Write a file',
    //       outputSchema: z.string().describe('A success message'),
    //       inputSchema: z.object({
    //         path: z.string().describe('The file path relative to the project root'),
    //         content: z.string().describe('The full content to write to the file'),
    //       }),
    //       execute: (async ({ path, content }) => {
    //         const fullPath = `${this.cwd}/${path}`;
    //         await writeFile(fullPath, content, 'utf-8');
    //         return `${path} updated successfully.`;
    //       }).bind(this),
    //     }),
    //   },
    // });

    // for await (const chunk of textStream) {
    //   process.stdout.write(chunk);
    // }
    // process.stdout.write('\n');
  }
}
