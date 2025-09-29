import { Plugin, PluginLifecycle } from '../plugin.js';
import { Context } from '../tool.js';

export default class NextJSPlugin extends Plugin implements PluginLifecycle {
  constructor(insights: Context['insights']) {
    super('NextJSPlugin', insights);
  }
  async detect(): Promise<boolean> {
    console.log('✅ Found Next.js 14.0.0.');
    return true;
  }

  async compile(): Promise<string> {
    return '';
  }
}
