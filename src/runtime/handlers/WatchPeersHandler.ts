// src/runtime/handlers/WatchPeersHandler.ts

import { listServes } from "@/cache/servesRepository";
import { base64ToBytes } from "@/cache/clientIdentity";
import { WATCH_PEERS } from "@/network/messageDefinitions/WATCH_PEERS";
import { RESERVED_KEY } from "@/network/Crypto";
import type { Command } from "@/runtime/commands";
import type { CommandHandler, OutputWorkerResult } from "./types";

type Cmd = Extract<Command, { type: "WATCH_PEERS" }>;

function compareBytes(a: Uint8Array, b: Uint8Array): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}

/**
 * WATCH_PEERS request.
 *
 * Reads every Serve the client knows about, converts each public key to
 * its raw 32 bytes, sorts them bytewise ascending, and sends them to the
 * server as a single PLAINTEXT payload addressed to RESERVED_KEY (ZERO).
 *
 * The codec rejects an empty payload, so if the client has no serves,
 * nothing is sent.
 *
 * The response arrives asynchronously on the ZERO path and produces a
 * PRESENCE_RESULT.
 */
export const WatchPeersHandler: CommandHandler<Cmd> = {
  async execute(): Promise<OutputWorkerResult> {
    let keys: Uint8Array[] = [];
    try {
      const serves = await listServes();
      keys = serves
        .map((s) => {
          try {
            return base64ToBytes(s.public_key);
          } catch {
            return null;
          }
        })
        .filter((k): k is Uint8Array => k !== null && k.length === 32);
      keys.sort(compareBytes);
    } catch (error) {
      console.warn(
        "[SIMServe][OUTPUT] WATCH_PEERS serve list read failed:",
        error,
      );
      return { results: [], sends: [] };
    }

    if (keys.length === 0) {
      // Codec requires a non-empty payload.
      return { results: [], sends: [] };
    }

    return {
      results: [],
      sends: [
        {
          messageType: WATCH_PEERS.id,
          data: keys,
          peerOverride: RESERVED_KEY,
          raw: true,
        },
      ],
    };
  },
};
