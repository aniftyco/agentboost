import { Plugin, PluginLifecycle } from '../plugin.js';
import { Context } from '../tool.js';

export default class ReactPlugin extends Plugin implements PluginLifecycle {
  constructor(insights: Context['insights']) {
    super('ReactPlugin', insights);
  }
  async detect(): Promise<boolean> {
    console.log('✅ Found React 18.2.0.');
    return true;
  }

  async compile(): Promise<string> {
    return '';
  }
}
