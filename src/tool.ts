import { InferToolInput, Tool, tool } from 'ai';

export type Context = { insights: Record<string, any> };

export default (schema: Tool) => (ctx: Context) =>
  tool({
    ...schema,
    execute: schema.execute.bind(ctx),
  });
