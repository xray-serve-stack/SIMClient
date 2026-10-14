// src/network/messageDefinitions/SyncStatusCommand.ts

import { GetSimsCommand } from "./GetSimsCommand";
import { GetConversationsCommand } from "./GetConversationsCommand";
import { GetMessagesSummaryCommand } from "./GetMessagesSummaryCommand";
import type { SyncStatusRequest, SyncStatusResponse } from "./SYNC_STATUS";

/**
 * Standalone SYNC_STATUS command.
 *
 *   - `buildSyncStatusData` constructs the `data` field of a request. The
 *     Python contract requires it to be an empty object. No envelope is
 *     built here; `request_id`, `created_at`, and `process_at` are
 *     produced upstream by `runtime/envelope.ts`.
 *
 *   - `processSyncStatusResult` delegates to the three primitive command
 *     classes in the order required by the protocol: SIMs, conversations,
 *     message summaries. Each step is awaited before the next begins. No
 *     validation, normalization, or database access is performed here;
 *     the codec has already validated the composite response and the
 *     primitive commands own their persistence.
 *
 *   The composite response nests each primitive's `data` under
 *   `response.data.GET_*`, but the primitive processors expect a full
 *   envelope (`{ request_id, created_at, process_at, data }`). Each
 *   delegation reuses the composite envelope fields and substitutes the
 *   primitive data.
 *
 * Not connected to the runtime.
 */
export class SyncStatusCommand {
  private readonly getSimsCommand = new GetSimsCommand();
  private readonly getConversationsCommand = new GetConversationsCommand();
  private readonly getMessagesSummaryCommand = new GetMessagesSummaryCommand();

  /**
   * The `data` field of a SYNC_STATUS request. The codec requires it to
   * be an empty object.
   */
  buildSyncStatusData(): SyncStatusRequest["data"] {
    return {};
  }

  /**
   * Process a decoded SYNC_STATUS response.
   *
   * `serveId` is the owning Serve's internal DB id, resolved upstream from
   * the packet peer. The composite response carries three primitive
   * payloads, each already validated by the SYNC_STATUS codec's
   * delegation to the primitive codecs.
   *
   * Execution order is fixed by the protocol:
   *   1. SIMs
   *   2. Conversations
   *   3. Message summaries
   *
   * Each step is awaited before the next starts. Failures propagate; the
   * remaining steps are not run.
   */
  async processSyncStatusResult(
    serveId: number,
    response: SyncStatusResponse,
  ): Promise<void> {
    const envelope = {
      request_id: response.request_id,
      created_at: response.created_at,
      process_at: response.process_at,
    };

    await this.getSimsCommand.processGetSimsResult(serveId, {
      ...envelope,
      data: response.data.GET_SIMS,
    });

    await this.getConversationsCommand.processGetConversationsResult(serveId, {
      ...envelope,
      data: response.data.GET_CONVERSATIONS,
    });

    await this.getMessagesSummaryCommand.processGetMessagesSummaryResult({
      ...envelope,
      data: response.data.GET_MESSAGES_SUMMARY,
    });
  }
}
