import { Plugin, PluginLifecycle } from '../plugin.js';
import { Context } from '../tool.js';

export default class VuePlugin extends Plugin implements PluginLifecycle {
  constructor(insights: Context['insights']) {
    super('VuePlugin', insights);
  }
  async detect(): Promise<boolean> {
    console.log('✅ Found Vue 3.4.0.');
    return true;
  }

  async compile(): Promise<string> {
    return '';
  }
}
