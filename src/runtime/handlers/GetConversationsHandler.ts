// src/runtime/handlers/GetConversationsHandler.ts

import {
  getConversations,
  getSubscriptionIdsForServe,
} from "@/cache/chatRepository";
import { GET_CONVERSATIONS } from "@/network/messageDefinitions/GET_CONVERSATIONS";
import { GetConversationsCommand } from "@/network/messageDefinitions/GetConversationsCommand";
import { ResultType } from "@/runtime/results";
import type { Command } from "@/runtime/commands";
import type { CommandHandler, OutputWorkerResult } from "./types";

type Cmd = Extract<Command, { type: "GET_CONVERSATIONS" }>;

const getConversationsCommand = new GetConversationsCommand();

/**
 * Cache slice: read the persisted conversations for a Serve.
 *
 * Pure read. No InputQueue, no network, no envelope.
 */
export async function readConversationsCache(serveId: number) {
  return await getConversations(serveId);
}

/**
 * Network slice: build the GET_CONVERSATIONS request `data`.
 *
 * Delegates to GetConversationsCommand.buildGetConversationsData. The
 * subscription_ids are read from the DB via getSubscriptionIdsForServe,
 * ordered by ordinal. This is the same source the GET_MESSAGES builder
 * uses.
 */
export async function buildGetConversationsRequestData(
  serveId: number,
): Promise<{ subscription_ids: number[] }> {
  const subscription_ids = await getSubscriptionIdsForServe(serveId);
  return getConversationsCommand.buildGetConversationsData(subscription_ids);
}

/**
 * Composite: GET_CONVERSATIONS standalone behavior.
 *
 *   1. cache read -> CONVERSATIONS_RESULT
 *   2. GET_CONVERSATIONS network request
 */
export const GetConversationsHandler: CommandHandler<Cmd> = {
  async execute(command): Promise<OutputWorkerResult> {
    const results: OutputWorkerResult["results"] = [];
    const sends: OutputWorkerResult["sends"] = [];

    try {
      const cached = await readConversationsCache(command.serveId);
      results.push({
        type: ResultType.CONVERSATIONS_RESULT,
        serveId: command.serveId,
        data: cached,
      });
    } catch (error) {
      console.warn(
        "[SIMServe][OUTPUT] GET_CONVERSATIONS cache read failed:",
        error,
      );
    }

    try {
      const data = await buildGetConversationsRequestData(command.serveId);
      sends.push({
        messageType: GET_CONVERSATIONS.id,
        data,
      });
    } catch (error) {
      console.warn(
        "[SIMServe][OUTPUT] GET_CONVERSATIONS request build failed:",
        error,
      );
    }

    return { results, sends };
  },
};
