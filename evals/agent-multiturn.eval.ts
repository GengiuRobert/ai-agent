import { evaluate } from "@lmnr-ai/lmnr";
import { llmJudge } from "./evaluators.ts";
import type {
  MultiTurnEvalData,
  MultiTurnResult,
  MultiTurnTarget,
} from "./types.ts";
import dataset from "./data/agent-multiturn.json" with { type: "json" };
import { multiTurnWithMocks } from "./executors.ts";

const executor = async (evalData: MultiTurnEvalData) => {
  return multiTurnWithMocks(evalData);
};

evaluate({
  data: dataset as any,
  executor,
  evaluators: {
    outputQuality: async (output: any, target: any) => {
      if (!target) return 1;
      return llmJudge(output as MultiTurnResult, target as MultiTurnTarget);
    },
  },
  config: {
    projectApiKey: process.env.LMNR_PROJECT_API_KEY,
  },
  groupName: "agent-multiturn",
});
