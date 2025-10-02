import { join } from 'node:path';
import { z } from 'zod';
import tool from '../tool.js';
import { buildPathTree } from '../utils.js';

export default tool({
  description: 'Get the source code tree starting from the current working directory',
  inputSchema: z.object({
    path: z.string().optional().describe('The directory path relative to the project root'),
  }),
  outputSchema: z.string().describe('A JSON representation of the source code tree'),
  async execute({ path }) {
    console.log('🔍 Building codebase tree...');
    const tree = await buildPathTree(path ? join(path, this.context.cwd) : this.context.cwd);
    return JSON.stringify(tree, null, 2);
  },
});
