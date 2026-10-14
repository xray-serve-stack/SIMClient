// src/runtime/handlers/GetSimsHandler.ts

import { getSims } from "@/cache/chatRepository";
import { GET_SIMS } from "@/network/messageDefinitions/GET_SIMS";
import { GetSimsCommand } from "@/network/messageDefinitions/GetSimsCommand";
import { ResultType } from "@/runtime/results";
import type { Command } from "@/runtime/commands";
import type { CommandHandler, OutputWorkerResult } from "./types";

type Cmd = Extract<Command, { type: "GET_SIMS" }>;

const getSimsCommand = new GetSimsCommand();

/**
 * Cache slice: read the persisted SIMs for a Serve.
 *
 * Pure read. No InputQueue, no network, no envelope. Usable directly by
 * any composite handler (e.g. SyncHandler) that needs the cache view.
 */
export async function readSimsCache(serveId: number) {
  return await getSims(serveId);
}

/**
 * Network slice: build the GET_SIMS request `data`.
 *
 * Pure. Delegates to GetSimsCommand.buildGetSimsData.
 */
export function buildGetSimsRequestData(): Record<string, never> {
  return getSimsCommand.buildGetSimsData();
}

/**
 * Composite: GET_SIMS standalone behavior.
 *
 *   1. cache read -> SIMS_RESULT
 *   2. GET_SIMS network request
 */
export const GetSimsHandler: CommandHandler<Cmd> = {
  async execute(command): Promise<OutputWorkerResult> {
    const results: OutputWorkerResult["results"] = [];
    const sends: OutputWorkerResult["sends"] = [];

    try {
      const cached = await readSimsCache(command.serveId);
      results.push({
        type: ResultType.SIMS_RESULT,
        serveId: command.serveId,
        data: cached,
      });
    } catch (error) {
      console.warn("[SIMServe][OUTPUT] GET_SIMS cache read failed:", error);
    }

    sends.push({
      messageType: GET_SIMS.id,
      data: buildGetSimsRequestData(),
    });

    return { results, sends };
  },
};
