// src/network/messageDefinitions/GetConversationsCommand.ts

import {
  getConversations,
  reconcileConversations,
  type ConversationReconcilePlan,
} from "@/cache/chatRepository";
import type { Conversation } from "@/types";
import type {
  GetConversationsRequest,
  GetConversationsResponse,
} from "./GET_CONVERSATIONS";

/**
 * Standalone GET_CONVERSATIONS command.
 *
 *   - `buildGetConversationsData` constructs the `data` field of a request.
 *     It does not build an envelope; `request_id`, `created_at`, and
 *     `process_at` are produced upstream by `runtime/envelope.ts`.
 *
 *   - `processGetConversationsResult` reconciles the decoded response with
 *     the existing `conversations` rows for one `serveId`, inside a single
 *     `readwrite` transaction on `STORE_CONVERSATIONS`. It does not touch
 *     the store, the queue, the network, or any other store.
 *
 * Not connected to the runtime.
 */
export class GetConversationsCommand {
  /**
   * The `data` field of a GET_CONVERSATIONS request. The codec requires a
   * non-empty array of integer `subscription_ids`. The caller's array is
   * copied; it is not mutated.
   */
  buildGetConversationsData(
    subscription_ids: readonly number[],
  ): GetConversationsRequest["data"] {
    return { subscription_ids: [...subscription_ids] };
  }

  /**
   * Reconcile the decoded response into the `conversations` store for one
   * serveId.
   *
   * `serveId` is the owning Serve's internal DB id, resolved upstream from
   * the packet peer. It is not part of the codec's response type.
   *
   * Reconcile rules:
   *   - new number                 -> insert with defaults (contactName "",
   *                                   selectedSimForSend 1, unread true)
   *   - existing, same timestamp   -> leave record untouched
   *   - existing, newer timestamp  -> update only timestamp, unread=true,
   *                                   preview; keep contactName and
   *                                   selectedSimForSend
   *   - existing, absent in response -> delete that row only
   *
   * Duplicate numbers within the response abort the operation before any
   * write, matching the all-or-nothing expectation of the caller. No
   * messages are deleted; orphaned messages are tolerated per the task.
   *
   * One read of the current rows, one write transaction via
   * `reconcileConversations`. The shared DB handle is used; nothing here
   * opens or closes the database.
   */
  async processGetConversationsResult(
    serveId: number,
    response: GetConversationsResponse,
  ): Promise<void> {
    const incoming = response.data;

    // Reject duplicate `number` in the response before any write.
    const seen = new Set<string>();
    for (const item of incoming) {
      if (seen.has(item.number)) {
        throw new Error(
          `GET_CONVERSATIONS response contains duplicate number: ${item.number}`,
        );
      }
      seen.add(item.number);
    }

    // Single snapshot read of the current rows for this serveId.
    const existing = await getConversations(serveId);
    const existingByNumber = new Map<string, Conversation>(
      existing.map((c) => [c.number, c]),
    );

    const upserts: Conversation[] = [];
    const deletes: Array<[number, string]> = [];

    const incomingNumbers = new Set<string>();

    for (const item of incoming) {
      incomingNumbers.add(item.number);
      const prior = existingByNumber.get(item.number);

      if (prior === undefined) {
        // New conversation.
        upserts.push({
          serveId,
          number: item.number,
          contactName: "",
          preview: item.preview,
          timestamp: item.last_message,
          unread: true,
        });
        continue;
      }

      if (prior.timestamp === item.last_message) {
        // Same timestamp: leave the record untouched.
        continue;
      }

      // Newer (or different) timestamp: update only the three permitted
      // fields. contactName and selectedSimForSend are preserved.
      upserts.push({
        ...prior,
        timestamp: item.last_message,
        unread: true,
        preview: item.preview,
      });
    }

    // Everything present in the snapshot but absent from the response is
    // deleted. Only the conversations store is touched; messages are not.
    for (const prior of existing) {
      if (!incomingNumbers.has(prior.number)) {
        deletes.push([serveId, prior.number]);
      }
    }

    const plan: ConversationReconcilePlan = { upserts, deletes };
    await reconcileConversations(serveId, plan);
  }
}
