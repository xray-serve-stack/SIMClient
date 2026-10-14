// src/runtime/handlers/SyncHandler.ts

import { SYNC_STATUS } from "@/network/messageDefinitions/SYNC_STATUS";
import { SyncStatusCommand } from "@/network/messageDefinitions/SyncStatusCommand";
import { ResultType } from "@/runtime/results";
import type { Command } from "@/runtime/commands";
import type { CommandHandler, OutputWorkerResult } from "./types";
import { readSimsCache } from "./GetSimsHandler";
import { readConversationsCache } from "./GetConversationsHandler";

type Cmd = Extract<Command, { type: "SYNC_STATUS" }>;

const syncStatusCommand = new SyncStatusCommand();

/**
 * Composite: SYNC_STATUS standalone behavior.
 *
 * Order, per the target flow:
 *   1. SIMs cache read           -> SIMS_RESULT
 *   2. Conversations cache read  -> CONVERSATIONS_RESULT
 *   3. SYNC_STATUS network request
 *
 * Uses only the pure cache functions of the two primitive handlers. It
 * does not call their composite functions, does not build primitive
 * request data, and does not import `inputQueue`, `remoteConnection`, or
 * `runtime/envelope`.
 */
export const SyncHandler: CommandHandler<Cmd> = {
  async execute(command): Promise<OutputWorkerResult> {
    const results: OutputWorkerResult["results"] = [];
    const sends: OutputWorkerResult["sends"] = [];

    try {
      const sims = await readSimsCache(command.serveId);
      results.push({
        type: ResultType.SIMS_RESULT,
        serveId: command.serveId,
        data: sims,
      });
    } catch (error) {
      console.warn(
        "[SIMServe][OUTPUT] SYNC_STATUS SIMs cache read failed:",
        error,
      );
    }

    try {
      const conversations = await readConversationsCache(command.serveId);
      results.push({
        type: ResultType.CONVERSATIONS_RESULT,
        serveId: command.serveId,
        data: conversations,
      });
    } catch (error) {
      console.warn(
        "[SIMServe][OUTPUT] SYNC_STATUS conversations cache read failed:",
        error,
      );
    }

    sends.push({
      messageType: SYNC_STATUS.id,
      data: syncStatusCommand.buildSyncStatusData(),
    });

    return { results, sends };
  },
};
