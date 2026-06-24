import { tool } from "ai";
import { z } from "zod";
import fs from "node:fs/promises";
import nodePath from "node:path";

export const readFile = tool({
  name: "readFile",
  description:
    "Reads the full contents of a file at the specified path, always use this to read a file",
  inputSchema: z.object({
    path: z.string().describe("The path to the file to read"),
  }),
  execute: async ({ path }) => {
    try {
      const content = await fs.readFile(path, "utf-8");
      return content;
    } catch (e) {
      return `There was an error reading the file, here is the native error message from node.js: ${e}`;
    }
  },
});

export const writeFile = tool({
  name: "writeFile",
  description:
    "Writes data to a file at the specified path, always use this to write a file. Creates the file if it does not exist, and overwrites the file if it does exist.",
  inputSchema: z.object({
    path: z.string().describe("The path to the file to write"),
    content: z.string().describe("The content to write to the file"),
  }),
  execute: async ({ path, content }) => {
    try {
      const dir = nodePath.dirname(path);
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(path, content, "utf-8");
      return `File written successfully to ${path} with content: ${content.length} characters`;
    } catch (e) {
      return `There was an error writing the file, here is the native error message from node.js: ${e}`;
    }
  },
});

export const listFiles = tool({
  name: "listFiles",
  description:
    "Lists all files and directories in a directory at the specified path, always use this to list files in a directory.",
  inputSchema: z.object({
    path: z
      .string()
      .describe("The path to the directory to list files from.")
      .default("."),
  }),
  execute: async ({ path }) => {
    try {
      const files = await fs.readdir(path, { withFileTypes: true });
      const items = files.map((file) => {
        const type = file.isDirectory() ? "[dir]" : "[file]";
        return `${type} ${file.name}`;
      });

      return items.length > 0
        ? items.join("\n")
        : `No files or directories found in ${path}`;
    } catch (e) {
      return `There was an error listing the files, here is the native error message from node.js: ${e}`;
    }
  },
});

export const deleteFile = tool({
  name: "deleteFile",
  description:
    "Deletes a specified file at the given path, always use this to delete a file. Use with caution, as this action is irreversible and will permanently remove the file from the filesystem.",
  inputSchema: z.object({
    path: z.string().describe("The path to the file to delete"),
  }),
  execute: async ({ path }) => {
    try {
      await fs.unlink(path);
      return `File deleted successfully from ${path}`;
    } catch (e) {
      return `There was an error deleting the file, here is the native error message from node.js: ${e}`;
    }
  },
});
