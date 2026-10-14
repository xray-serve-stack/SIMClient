// src/runtime/handlers/RenameServeHandler.ts

import { renameServe, DuplicateServeError } from "@/cache/servesRepository";
import { ResultType } from "@/runtime/results";
import type { Command } from "@/runtime/commands";
import type { CommandHandler, OutputWorkerResult } from "./types";

type Cmd = Extract<Command, { type: "RENAME_SERVE" }>;

export const RenameServeHandler: CommandHandler<Cmd> = {
  async execute(command): Promise<OutputWorkerResult> {
    try {
      const serve = await renameServe(command.id, command.device_name);
      return {
        results: [{ type: ResultType.SERVE_RENAMED_RESULT, serve }],
        sends: [],
      };
    } catch (error) {
      const message =
        error instanceof DuplicateServeError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to rename Serve";
      return {
        results: [
          {
            type: ResultType.SERVE_WRITE_FAILED_RESULT,
            operation: "rename",
            message,
          },
        ],
        sends: [],
      };
    }
  },
};
