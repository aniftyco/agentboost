import { InferToolInput, Tool, tool } from 'ai';

export type Context = Record<string, any>;

export default (schema: Tool) => (ctx: Context) =>
  tool({
    ...schema,
    execute: schema.execute.bind(ctx),
  });
