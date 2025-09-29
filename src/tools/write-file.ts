import { writeFile } from 'fs/promises';
import { z } from 'zod';
import tool from '../tool.js';

export default tool({
  description: 'Write a file',
  outputSchema: z.string().describe('A success message'),
  inputSchema: z.object({
    path: z.string().describe('The file path relative to the project root'),
    content: z.string().describe('The full content to write to the file'),
  }),
  async execute({ path, content }) {
    const fullPath = `${this.insights.cwd}/${path}`;
    try {
      await writeFile(fullPath, content, 'utf-8');
      return `${path} updated successfully.`;
    } catch (e) {
      return `Failed to write ${path}.`;
    }
  },
});
