import { readdirSync, write } from 'fs';
import { writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { Plugin, PluginLifecycle } from './plugin.js';
import { parseArgs } from './utils.js';

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

  async emit(event: LifeCycleEvent): Promise<void | string> {
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
        return compiled.join('\n');
      }
      default: {
        throw new Error(`Unknown event: ${event}`);
      }
    }
  }

  async run(argv: string[]): Promise<void> {
    const { command = 'init', params } = parseArgs(argv);

    console.log('🔍 Detecting project structure...');
    await this.emit('detect');
    switch (command) {
      case 'init': {
        const agentsFile = await this.emit('compile');
        writeFile(join(this.cwd, 'AGENTS.md'), agentsFile || '', 'utf-8');
        console.log('📝 Generated AGENTS.md successfully!');
        break;
      }
      default: {
        console.error(`Unknown command: ${command}`);
        process.exit(1);
      }
    }
  }
}
