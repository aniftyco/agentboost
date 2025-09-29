import { Context } from './tool.js';

export interface PluginLifecycle {
  name: string;
  detect(): Promise<boolean>;
  compile(): Promise<string>;
}

export abstract class Plugin {
  constructor(
    public readonly name: string,
    public readonly insights: Context['insights']
  ) {}
}
