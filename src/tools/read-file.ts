import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import tool from '../tool.js';

export default tool({
  description: 'Read a file',
  inputSchema: z.object({
    path: z.string().describe('The file path relative to the project root'),
  }),
  outputSchema: z.string().describe('The UTF-8 text content of the file'),
  async execute({ path }) {
    console.log(`📄 Reading file: ${path}`);
    try {
      return await readFile(`${this.insights.cwd}/${path}`, 'utf-8');
    } catch (e) {
      return '';
    }
  },
});
