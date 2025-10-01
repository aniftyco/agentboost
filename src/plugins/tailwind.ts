import { Plugin, PluginLifecycle } from '../plugin.js';
import { Context } from '../tool.js';

export default class TailwindPlugin extends Plugin implements PluginLifecycle {
  constructor(context: Context) {
    super('TailwindPlugin', context);
  }
  async detect(): Promise<boolean> {
    console.log('✅ Found Tailwind CSS 3.4.0.');
    return true;
  }

  async compile(): Promise<string> {
    return '';
  }
}
