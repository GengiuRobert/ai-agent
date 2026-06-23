import { tools } from "./tools/index.ts";

export type ToolName = keyof typeof tools;

export const executeTool = async (toolName: string, args: any) => {
  const tool = tools[toolName as ToolName];

  if (!tool) {
    return `Unknown tool: ${toolName}, this tool does not exist`;
  }

  const execute = tool.execute;

  if (!execute) {
    return `This is not a regiterred tool: ${toolName}, this tool does not have an execute function`;
  }

  const result = await execute(args, {
    toolCallId: "",
    messages: [],
  });

  return String(result);
};
