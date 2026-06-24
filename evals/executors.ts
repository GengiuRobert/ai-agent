import type {
  EvalData,
  SingleTurnResult,
  MultiTurnEvalData,
  MultiTurnResult,
} from "./types.ts";

import {
  generateText,
  stepCountIs,
  tool,
  type ModelMessage,
  type ToolSet,
} from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { buildMessages, buildMockedTools } from "./utils.ts";
import { SYSTEM_PROMPT } from "../src/agent/system/prompt.ts";

const TOOL_DEFINITIONS: any = {
  readFile: {
    description: "Reads the contents of a file at the specified path",
    parameters: z.object({
      path: z.string().describe("The path to the file to read"),
    }),
  },
  writeFile: {
    description: "Writes data to a file",
    parameters: z.object({
      path: z.string().describe("The path to the file to write"),
      content: z.string().describe("The content to write to the file"),
    }),
  },
  listFiles: {
    description: "Lists all files in a directory",
    parameters: z.object({
      path: z.string().describe("The path to the directory to list files from"),
    }),
  },
  deleteFile: {
    description: "Deletes a specified file at the given path",
    parameters: z.object({
      path: z.string().describe("The path to the file to delete"),
    }),
  },
  runCommand: {
    description: "Executes a shell command and returns the output",
    parameters: z.object({
      command: z.string().describe("The command to execute"),
    }),
  },
};

export const singleTurnExecutor = async (
  evalData: EvalData,
): Promise<SingleTurnResult> => {
  const messages = buildMessages(evalData);
  const tools: ToolSet = {};

  for (const toolName of evalData.tools) {
    const def = TOOL_DEFINITIONS[toolName];

    if (def) {
      tools[toolName] = tool({
        name: toolName,
        description: def.description,
        inputSchema: def.parameters,
      });
    }
  }

  const { toolCalls } = await generateText({
    model: openai(evalData.config?.model ?? "gpt-5-mini"),
    messages,
    tools,
    stopWhen: stepCountIs(1),
    temperature: evalData.config?.temperature ?? undefined,
  });

  const calls = toolCalls.map((call) => ({
    toolName: call.toolName,
    args: "args" in call ? call.args : {},
  }));

  const toolNames = calls.map((call) => call.toolName);

  return {
    toolCalls: calls,
    toolNames,
    selectedAny: toolNames.length > 0,
  };
};

export const multiTurnWithMocks = async (data: MultiTurnEvalData) => {
  const tools = buildMockedTools(data.mockTools);

  const messages: ModelMessage[] = data.messages ?? [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: data.prompt!,
    },
  ];

  const results = await generateText({
    model: openai(data.config?.model ?? "gpt-5-mini"),
    messages,
    tools,
    stopWhen: stepCountIs(data.config?.maxSteps ?? 20),
  });

  const allToolCalls: string[] = [];
  const steps = results.steps.map((step) => {
    const stepToolCalls = (step.toolCalls ?? []).map((call) => {
      allToolCalls.push(call.toolName);
      return {
        toolName: call.toolName,
        args: "args" in call ? call.args : {},
      };
    });

    const stepResults = (step.staticToolResults ?? []).map((result) => ({
      toolName: result.toolName,
      result: "result" in result ? result.result : result,
    }));

    return {
      toolCalls: stepToolCalls.length > 0 ? stepToolCalls : undefined,
      toolResults: stepResults.length > 0 ? stepResults : undefined,
      text: step.text || undefined,
    };
  });

  const toolsUsed = [new Set(allToolCalls)];

  return {
    text: results.text,
    steps,
    toolsUsed,
    toolCallOrder: allToolCalls,
  };
};
