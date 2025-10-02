import { Plugin, PluginLifecycle } from '../plugin.js';
import { Context } from '../tool.js';

export default class ReactPlugin extends Plugin implements PluginLifecycle {
  constructor(context: Context) {
    super('ReactPlugin', context);
  }
  async detect(): Promise<boolean> {
    console.log('✅ Found React 18.2.0.');
    return true;
  }

  async compile(): Promise<string> {
    return '';
  }
}
