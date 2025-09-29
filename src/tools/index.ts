import { Context } from '../tool.js';
import codebase from './codebase.js';
import readFile from './read-file.js';
import writeFile from './write-file.js';

export default (ctx: Context) => ({
  codebase: codebase(ctx),
  readFile: readFile(ctx),
  writeFile: writeFile(ctx),
});
