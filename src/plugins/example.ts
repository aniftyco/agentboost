import { Plugin, PluginLifecycle } from '../plugin.js';

export default class ExamplePlugin extends Plugin implements PluginLifecycle {
  constructor(insights: any) {
    super('ExamplePlugin', insights);
  }
  async detect(): Promise<boolean> {
    return false;
  }

  async compile(): Promise<string> {
    return 'Hello World';
  }
}
