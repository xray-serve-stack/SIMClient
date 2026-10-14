// src/network/messageDefinitions/GetSimsCommand.ts

import { saveSims } from "@/cache/chatRepository";
import type { Sim } from "@/types";
import type { GetSimsRequest, GetSimsResponse } from "./GET_SIMS";

/**
 * Standalone GET_SIMS command.
 *
 * Two responsibilities, both self-contained:
 *
 *   - `buildGetSimsData` constructs the `data` payload of a GET_SIMS
 *     request. It does NOT build an envelope. `request_id`, `created_at`,
 *     and `process_at` are produced upstream by `runtime/envelope.ts`.
 *
 *   - `processGetSimsResult` takes a decoded `GetSimsResponse` (already
 *     produced by `GetSimsPayloadCodec.parse` with `PeerRole.CLIENT`) and
 *     persists the SIMs to the existing database via `saveSims`. The
 *     database handle is managed by `chatRepository` and is already open;
 *     this class does not open or close it, does not touch the store, and
 *     does not enqueue commands.
 *
 * Neither method is connected to the runtime yet.
 */
export class GetSimsCommand {
  /**
   * The `data` field of a GET_SIMS request. The codec requires it to be an
   * empty object.
   */
  buildGetSimsData(): GetSimsRequest["data"] {
    return {};
  }

  /**
   * Persist the decoded SIMs for exactly one Serve.
   *
   * `serveId` is the owning Serve's internal DB id, resolved upstream from
   * the packet peer by the response-processing context. It is the only
   * value that scopes the replacement.
   *
   * `saveSims(serveId, sims)` performs the delete-and-insert for that
   * serveId inside a single readwrite transaction on `STORE_SIMS`,
   * reusing the shared open handle. Rows belonging to any other serveId
   * are not touched. This method does not open, close, or otherwise
   * manage the database.
   */
  async processGetSimsResult(
    serveId: number,
    response: GetSimsResponse,
  ): Promise<void> {
    const sims: Sim[] = response.data.map((sim, index) => ({
      serveId,
      subscription_id: sim.subscription_id,
      slot_index: sim.slot_index,
      number: sim.number,
      carrier_name: sim.carrier_name,
      display_name: sim.display_name,
      country_iso: sim.country_iso,
      mcc: sim.mcc,
      mnc: sim.mnc,
      is_default_sms: sim.is_default_sms,
      ordinal: index + 1,
    }));

    await saveSims(serveId, sims);
  }
}
