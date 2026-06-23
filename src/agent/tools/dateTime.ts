import { tool } from "ai";
import { z } from "zod";

export const dateTimeTool = tool({
  description:
    "Return the current time and date. Use this tool before any time related task",
  inputSchema: z.object({}),
  execute: async () => {
    const now = new Date();
    return now.toISOString();
  },
});
