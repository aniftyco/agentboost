import { openai } from '@ai-sdk/openai';
import { stepCountIs, streamText } from 'ai';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Plugin, PluginLifecycle } from '../plugin.js';
import { Context } from '../tool.js';
import tools from '../tools/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default class BigPicturePlugin extends Plugin implements PluginLifecycle {
  constructor(insights: Context['insights']) {
    super('BigPicturePlugin', insights);
  }
  async detect(): Promise<boolean> {
    console.log('✅ Found "Big Picture" architectural decisions.');
    return true;
  }

  async compile(): Promise<string> {
    const response = streamText({
      model: openai('gpt-4o'),
      prompt: await readFile(join(__dirname, '../../prompt.md'), 'utf-8'),
      stopWhen: stepCountIs(10),
      tools: tools(this),
    });

    return (await response.text).trim();
  }
}
