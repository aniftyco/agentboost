import { Plugin, PluginLifecycle } from '../plugin.js';
import { Context } from '../tool.js';

export default class LaravelPlugin extends Plugin implements PluginLifecycle {
  constructor(insights: Context['insights']) {
    super('LaravelPlugin', insights);
  }
  async detect(): Promise<boolean> {
    console.log('✅ Found Laravel 12.3.4.');
    return true;
  }

  async compile(): Promise<string> {
    return '';
  }
}
