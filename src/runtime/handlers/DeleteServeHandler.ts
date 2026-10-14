// src/runtime/handlers/DeleteServeHandler.ts

import { deleteServe } from "@/cache/servesRepository";
import { ResultType } from "@/runtime/results";
import type { Command } from "@/runtime/commands";
import type { CommandHandler, OutputWorkerResult } from "./types";

type Cmd = Extract<Command, { type: "DELETE_SERVE" }>;

export const DeleteServeHandler: CommandHandler<Cmd> = {
  async execute(command): Promise<OutputWorkerResult> {
    try {
      await deleteServe(command.id);
      return {
        results: [{ type: ResultType.SERVE_DELETED_RESULT, id: command.id }],
        sends: [],
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete Serve";
      return {
        results: [
          {
            type: ResultType.SERVE_WRITE_FAILED_RESULT,
            operation: "delete",
            message,
          },
        ],
        sends: [],
      };
    }
  },
};
