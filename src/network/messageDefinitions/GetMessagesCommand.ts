// src/network/messageDefinitions/GetMessagesCommand.ts

import {
  countMessagesUpTo,
  getLatestMessageTimestamp,
  getSubscriptionIdsForServe,
  insertMessages,
  replaceAllMessages,
} from "@/cache/chatRepository";
import { enqueueCommand } from "@/runtime/commandQueue";
import { CommandType } from "@/runtime/commands";
import type {
  GetMessagesRequestData,
  GetMessagesResponse,
} from "./GET_MESSAGES";

/**
 * Standalone GET_MESSAGES command.
 *
 * Range semantics (unchanged):
 *   - `start` is the inclusive lower bound on timestamp for the request.
 *     `end` is always null.
 *   - `next_start` is the inclusive lower bound for the next page; it is
 *     passed through unchanged as the next request's `start`.
 *   - `cached_count` is the number of persisted messages for the
 *     conversation whose timestamp is <= `start`, inclusive. That is the
 *     contract the Serve compares against.
 *
 * Persistence semantics (this task):
 *   - Full sync is detected when MIN_response < MAX_cache, where
 *     MAX_cache is the highest persisted timestamp for (serveId, number)
 *     and MIN_response is the lowest timestamp in the response. In that
 *     case, all cached rows for the conversation are deleted and the
 *     response rows are inserted, in one transaction.
 *   - Otherwise, the response rows are inserted without deleting anything.
 *   - An empty response does not touch the database.
 *   - An empty cache (MAX_cache === null) is NOT a full sync.
 */
export class GetMessagesCommand {
  async buildGetMessagesData(params: {
    serveId: number;
    number: string;
    start?: number | null;
  }): Promise<GetMessagesRequestData> {
    const subscription_ids = await getSubscriptionIdsForServe(params.serveId);

    let start: number | null;
    if (params.start !== undefined && params.start !== null) {
      start = params.start;
    } else {
      start = await getLatestMessageTimestamp(params.serveId, params.number);
    }

    const cached_count =
      start === null
        ? 0
        : await countMessagesUpTo(params.serveId, params.number, start);

    return {
      subscription_ids,
      number: params.number,
      start,
      end: null,
      cached_count,
      limit: null,
    };
  }

  async processGetMessagesResult(
    serveId: number,
    number: string,
    response: GetMessagesResponse,
  ): Promise<void> {
    const { messages, remaining, next_start } = response.data;

    if (messages.length > 0) {
      const maxCache = await getLatestMessageTimestamp(serveId, number);

      let minResponse = messages[0].timestamp;
      for (const m of messages) {
        if (m.timestamp < minResponse) minResponse = m.timestamp;
      }

      const isFullSync = maxCache !== null && minResponse < maxCache;

      const rows = messages.map((m) => ({
        timestamp: m.timestamp,
        body: m.body,
        subscription_id: m.subscription_id,
        messageType: m.type,
      }));

      if (isFullSync) {
        await replaceAllMessages(serveId, number, rows);
      } else {
        await insertMessages(
          serveId,
          rows.map((r) => ({ ...r, number })),
        );
      }
    }

    if (remaining === 0) return;

    const data = await this.buildGetMessagesData({
      serveId,
      number,
      start: next_start,
    });

    enqueueCommand({
      type: CommandType.GET_MESSAGES,
      serveId,
      subscription_ids: data.subscription_ids,
      number,
      start: data.start,
      cached_count: data.cached_count,
    });
  }
}
