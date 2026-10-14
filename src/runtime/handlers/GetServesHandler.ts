// src/runtime/handlers/GetServesHandler.ts

import { listServes } from "@/cache/servesRepository";
import { ResultType } from "@/runtime/results";
import type { Command } from "@/runtime/commands";
import type { CommandHandler, OutputWorkerResult } from "./types";

type Cmd = Extract<Command, { type: "GET_SERVES" }>;

export const GetServesHandler: CommandHandler<Cmd> = {
  async execute(): Promise<OutputWorkerResult> {
    const data = await listServes();
    return {
      results: [{ type: ResultType.SERVES_RESULT, data }],
      sends: [],
    };
  },
};
