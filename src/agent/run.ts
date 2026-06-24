import "dotenv/config";
import { streamText, type ModelMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { SYSTEM_PROMPT } from "./system/prompt.ts";
import type { AgentCallbacks, ToolCallInfo } from "../types.ts";
import { tools } from "./tools/index.ts";
import { getTracer, Laminar } from "@lmnr-ai/lmnr";
import { filterCompatibleMessages } from "./system/filterMessages.ts";
import { executeTool } from "./executeTools.ts";
import {
  estimateMessagesTokens,
  getModelLimits,
  isOverThreshold,
  calculateUsagePercentage,
  compactConversation,
  DEFAULT_THRESHOLD,
} from "./context/index.ts";

const MODEL_NAME = "gpt-5-mini";

Laminar.initialize({
  projectApiKey: process.env.LMNR_PROJECT_API_KEY,
});

export const runAgent = async (
  userMessage: string,
  conversationHistory: ModelMessage[],
  callbacks: AgentCallbacks,
) => {
  const modelLimits = getModelLimits(MODEL_NAME);

  const workingHistory = filterCompatibleMessages(conversationHistory);

  const messages: ModelMessage[] = [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    ...workingHistory,
    {
      role: "user",
      content: userMessage,
    },
  ];

  const precheckTokens = estimateMessagesTokens(messages);

  if (isOverThreshold(precheckTokens.total, modelLimits.contextWindow)) {
    await compactConversation(messages, MODEL_NAME);
  }

  let fullResponse = "";

  while (true) {
    const result = streamText({
      model: openai(MODEL_NAME),
      messages,
      tools,
      experimental_telemetry: {
        isEnabled: true,
        tracer: getTracer(),
      },
    });

    const reportTokenUsage = () => {
      if (callbacks.onTokenUsage) {
        const usage = estimateMessagesTokens(messages);
        callbacks.onTokenUsage({
          inputTokens: usage.input,
          outputTokens: usage.output,
          totalTokens: usage.total,
          contextWindow: modelLimits.contextWindow,
          threshold: DEFAULT_THRESHOLD,
          percentage: calculateUsagePercentage(
            usage.total,
            modelLimits.contextWindow,
          ),
        });
      }
    };

    const toolCalls: ToolCallInfo[] = [];
    let currentText = "";
    let streamError: Error | null = null;

    try {
      for await (const chunk of result.fullStream) {
        if (chunk.type === "text-delta") {
          currentText += chunk.text;
          callbacks.onToken(chunk.text);
        }
        if (chunk.type === "tool-call") {
          const input = "input" in chunk ? chunk.input : {};
          toolCalls.push({
            toolCallId: chunk.toolCallId,
            toolName: chunk.toolName,
            args: input as any,
          });
          callbacks.onToolCallStart(chunk.toolName, input);
        }
      }
    } catch (err) {
      streamError = err as Error;

      if (
        !currentText &&
        !streamError.message.includes("No output generated")
      ) {
        throw streamError;
      }
    }

    fullResponse += currentText;

    if (streamError && !currentText) {
      fullResponse = "Sorry about that.";
      callbacks.onToken(fullResponse);
      break;
    }

    const finishReason = await result.finishReason;

    if (finishReason !== "tool-calls" || toolCalls.length === 0) {
      const responseMessages = await result.response;
      messages.push(...responseMessages.messages);
      reportTokenUsage();
      break;
    }

    const responseMessages = await result.response;
    messages.push(...responseMessages.messages);

    for (const tc of toolCalls) {
      const result = await executeTool(tc.toolName, tc.args);

      callbacks.onToolCallEnd(tc.toolName, result);

      messages.push({
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: tc.toolCallId,
            toolName: tc.toolName,
            output: {
              type: "text",
              value: result,
            },
          },
        ],
      });

      reportTokenUsage();
    }
  }

  callbacks.onComplete(fullResponse);
  return messages;
};
