// All tools combined for the agent

import { dateTimeTool } from "./dateTime.ts";
import { deleteFile, listFiles, readFile, writeFile } from "./file.ts";
import { webSearch } from "./webSearch.ts";

export const tools = {
  dateTimeTool,
  writeFile,
  readFile,
  listFiles,
  deleteFile,
  webSearch,
};
