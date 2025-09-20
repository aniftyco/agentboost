import { openai } from '@ai-sdk/openai';
import { stepCountIs, streamText, tool } from 'ai';
import { readFile, writeFile } from 'fs/promises';
import path, { join } from 'path';
import { z } from 'zod';
import { parseArgs, buildPathTree } from './utils.js';

export class AgentBoost {
  constructor(public readonly cwd: string) {}

  async getPrompt(): Promise<string> {
    return readFile(path.join(import.meta.dirname, '../prompt.md'), 'utf-8');
  }

  async run(argv: string[]): Promise<void> {
    const { command = 'init', params } = parseArgs(argv);

    const { textStream } = streamText({
      model: openai('gpt-4o'),
      prompt: await this.getPrompt(),
      stopWhen: stepCountIs(10),
      tools: {
        codebase: tool({
          description: 'Get the source code tree starting from the current working directory',
          inputSchema: z.object({
            path: z.string().optional().describe('The directory path relative to the project root'),
          }),
          outputSchema: z.string().describe('A JSON representation of the source code tree'),
          execute: (async ({ path }) => {
            const tree = await buildPathTree(path ? join(path, this.cwd) : this.cwd);
            return JSON.stringify(tree, null, 2);
          }).bind(this),
        }),
        read: tool({
          description: 'Read a file',
          inputSchema: z.object({
            path: z.string().describe('The file path relative to the project root'),
          }),
          outputSchema: z.string().describe('The UTF-8 text content of the file'),
          execute: (async ({ path }) => {
            try {
              return await readFile(`${this.cwd}/${path}`, 'utf-8');
            } catch (e) {
              return '';
            }
          }).bind(this),
        }),
        write: tool({
          description: 'Write a file',
          outputSchema: z.string().describe('A success message'),
          inputSchema: z.object({
            path: z.string().describe('The file path relative to the project root'),
            content: z.string().describe('The full content to write to the file'),
          }),
          execute: (async ({ path, content }) => {
            const fullPath = `${this.cwd}/${path}`;
            await writeFile(fullPath, content, 'utf-8');
            return `${path} updated successfully.`;
          }).bind(this),
        }),
      },
    });

    for await (const chunk of textStream) {
      process.stdout.write(chunk);
    }
    process.stdout.write('\n');
  }
}
