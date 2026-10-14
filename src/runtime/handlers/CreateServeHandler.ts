// src/runtime/handlers/CreateServeHandler.ts

import { createServe, DuplicateServeError } from "@/cache/servesRepository";
import { ResultType } from "@/runtime/results";
import type { Command } from "@/runtime/commands";
import type { CommandHandler, OutputWorkerResult } from "./types";

type Cmd = Extract<Command, { type: "CREATE_SERVE" }>;

export const CreateServeHandler: CommandHandler<Cmd> = {
  async execute(command): Promise<OutputWorkerResult> {
    try {
      const serve = await createServe({
        public_key: command.public_key,
        device_name: command.device_name,
      });
      return {
        results: [{ type: ResultType.SERVE_CREATED_RESULT, serve }],
        sends: [],
      };
    } catch (error) {
      const message =
        error instanceof DuplicateServeError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to create Serve";
      return {
        results: [
          {
            type: ResultType.SERVE_WRITE_FAILED_RESULT,
            operation: "create",
            message,
          },
        ],
        sends: [],
      };
    }
  },
};
