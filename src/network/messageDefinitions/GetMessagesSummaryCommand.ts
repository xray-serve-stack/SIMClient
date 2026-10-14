// src/network/messageDefinitions/GetMessagesSummaryCommand.ts

import type {
  GetMessagesSummaryRequest,
  GetMessagesSummaryResponse,
} from "./GET_MESSAGES_SUMMARY";

/**
 * Standalone GET_MESSAGES_SUMMARY command.
 *
 *   - `buildGetMessagesSummaryData` constructs the `data` field of a
 *     request. It does not build an envelope; `request_id`, `created_at`,
 *     and `process_at` are produced upstream by `runtime/envelope.ts`.
 *
 *   - `processGetMessagesSummaryResult` is intentionally a no-op for now.
 *     The task that will use this response (change detection, sync
 *     initiation) is out of scope. The method accepts the parsed response
 *     and returns without touching the database, the store, the queue, or
 *     the network. Keeping the signature in place means the future
 *     implementation does not need a new call site.
 *
 * Not connected to the runtime.
 */
export class GetMessagesSummaryCommand {
  /**
   * The `data` field of a GET_MESSAGES_SUMMARY request. The codec requires
   * a non-empty array of integer `subscription_ids`. The caller's array is
   * copied; it is not mutated.
   */
  buildGetMessagesSummaryData(
    subscription_ids: readonly number[],
  ): GetMessagesSummaryRequest["data"] {
    return { subscription_ids: [...subscription_ids] };
  }

  /**
   * No-op by design.
   *
   * The response has already been validated by `GetMessagesSummaryPayloadCodec`
   * with `PeerRole.CLIENT`. Nothing is persisted, enqueued, or emitted from
   * this method in the current version.
   */
  async processGetMessagesSummaryResult(
    _response: GetMessagesSummaryResponse,
  ): Promise<void> {
    return;
  }
}
