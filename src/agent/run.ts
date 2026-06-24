import "dotenv/config";
import { generateText, type ModelMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { SYSTEM_PROMPT } from "./system/prompt.ts";
import type { AgentCallbacks } from "../types.ts";
import { executeTool } from "./executeTools.ts";
import { tools } from "./tools/index.ts";

import { getTracer, Laminar } from "@lmnr-ai/lmnr";

const MODEL_NAME = "gpt-5-mini";

Laminar.initialize({
  projectApiKey: process.env.LMNR_PROJECT_API_KEY,
});

export const runAgent = async (
  userMessage: string,
  conversationHistory: ModelMessage[],
  callbacks: AgentCallbacks,
) => {
  const { text, toolCalls } = await generateText({
    model: openai(MODEL_NAME),
    prompt: userMessage,
    //messages: [],
    system: SYSTEM_PROMPT,
    tools,
    experimental_telemetry: {
      isEnabled: true,
      tracer: getTracer(),
    },
  });

  await Laminar.flush();

  console.log(text, toolCalls);

  toolCalls.forEach(async (toolCall) => {
    console.log(await executeTool(toolCall.toolName, toolCall.input));
  });
};

runAgent("what is the current time right now?");
