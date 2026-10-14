// src/network/ApplicationDispatcher.ts

import { MessageDefinition } from "./protocol";
import { GET_SIMS, type GetSimsResponse } from "./messageDefinitions/GET_SIMS";
import {
  GET_MESSAGES,
  type GetMessagesResponse,
} from "./messageDefinitions/GET_MESSAGES";
import {
  SYNC_STATUS,
  type SyncStatusResponse,
} from "./messageDefinitions/SYNC_STATUS";
import { WATCH_PEERS } from "./messageDefinitions/WATCH_PEERS";
import { PEER_ONLINE } from "./messageDefinitions/PEER_ONLINE";
import { PEER_OFFLINE } from "./messageDefinitions/PEER_OFFLINE";
import { GetMessagesCommand } from "./messageDefinitions/GetMessagesCommand";
import { inputQueue } from "@/runtime/inputQueue";
import { ResultType } from "@/runtime/results";
import { bytesToBase64 } from "@/cache/clientIdentity";
import { listServes } from "@/cache/servesRepository";
import { getActiveChat } from "@/runtime/activeServeProvider";
import { readMessagesForResult } from "@/runtime/handlers/GetMessagesHandler";

// ---- Serve-scoped dispatcher (unchanged) ---------------------------------

type Handler<T> = (
  definition: MessageDefinition<T>,
  payload: T,
  originServeId: number,
) => void;

const handlers = new Map<number, Handler<unknown>>();

function register<T>(
  definition: MessageDefinition<T>,
  handler: Handler<T>,
): void {
  handlers.set(definition.id, handler as Handler<unknown>);
}

const getMessagesCommand = new GetMessagesCommand();

register<GetSimsResponse>(
  GET_SIMS as MessageDefinition<GetSimsResponse>,
  (definition, payload, originServeId) => {
    if (definition.id !== 11) return;
    const data = payload.data.map((sim, index) => ({
      serveId: originServeId,
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
    inputQueue.enqueue({
      type: ResultType.SIMS_RESULT,
      serveId: originServeId,
      data,
    });
  },
);

register<GetMessagesResponse>(
  GET_MESSAGES as MessageDefinition<GetMessagesResponse>,
  (definition, payload, originServeId) => {
    if (definition.id !== 13) return;
    const number = getActiveChat();
    if (number === null) {
      console.warn(
        "[SIMServe][APP] GET_MESSAGES response arrived but no active chat is set; dropping",
      );
      return;
    }
    void (async () => {
      try {
        await getMessagesCommand.processGetMessagesResult(
          originServeId,
          number,
          payload,
        );
      } catch (error) {
        console.error(
          `[SIMServe][APP] GET_MESSAGES persistence failed (serveId=${originServeId}, number=${number}):`,
          error,
        );
        return;
      }

      try {
        const { history, draft } = await readMessagesForResult(
          originServeId,
          number,
        );
        inputQueue.enqueue({
          type: ResultType.MESSAGES_RESULT,
          serveId: originServeId,
          number,
          data: history,
          draft,
        });
      } catch (error) {
        console.error(
          `[SIMServe][APP] GET_MESSAGES store refresh failed (serveId=${originServeId}, number=${number}):`,
          error,
        );
      }
    })();
  },
);

register<SyncStatusResponse>(
  SYNC_STATUS as MessageDefinition<SyncStatusResponse>,
  (definition, payload, originServeId) => {
    if (definition.id !== 1000) return;
    inputQueue.enqueue({
      type: ResultType.SYNC_STATUS_RESULT,
      serveId: originServeId,
      response: payload,
    });
  },
);

async function resolveServeIdForPeer(peer: Uint8Array): Promise<number | null> {
  const peerB64 = bytesToBase64(peer);
  const serves = await listServes();
  const match = serves.find((s) => s.public_key === peerB64);
  if (!match || typeof match.id !== "number") return null;
  return match.id;
}

export async function dispatchApplicationPayload<T>(
  definition: MessageDefinition<T>,
  payload: T,
  peer: Uint8Array,
): Promise<void> {
  const handler = handlers.get(definition.id);
  if (!handler) {
    console.warn(
      `[SIMServe][APP] no application handler for message type ${definition.id} (${definition.name})`,
    );
    return;
  }

  const originServeId = await resolveServeIdForPeer(peer);
  if (originServeId === null) {
    console.warn(
      `[SIMServe][APP] no Serve matches packet peer for type ${definition.id} (${definition.name})`,
    );
    return;
  }

  handler(definition, payload, originServeId);
}

// ---- Server-event dispatcher (ZERO peer) ---------------------------------
//
// Server events originate from the reserved ZERO peer. They are not
// addressed to any Serve and are PLAINTEXT. They therefore have no
// `serveId` and no shared secret. This dispatcher is separate from the
// Serve-scoped one so the two routing rules cannot be confused.

type ServerEventHandler<T> = (
  definition: MessageDefinition<T>,
  payload: T,
) => void;

const serverEventHandlers = new Map<number, ServerEventHandler<unknown>>();

function registerServerEvent<T>(
  definition: MessageDefinition<T>,
  handler: ServerEventHandler<T>,
): void {
  serverEventHandlers.set(
    definition.id,
    handler as ServerEventHandler<unknown>,
  );
}

registerServerEvent<Uint8Array[]>(
  WATCH_PEERS as MessageDefinition<Uint8Array[]>,
  (definition, payload) => {
    if (definition.id !== 2) return;

    // Payload is Uint8Array[], one 32-byte chunk per online peer.
    const onlinePublicKeys = payload.map((k) => bytesToBase64(k));

    inputQueue.enqueue({
      type: ResultType.PRESENCE_RESULT,
      onlinePublicKeys,
    });
  },
);

registerServerEvent<Uint8Array>(
  PEER_ONLINE as MessageDefinition<Uint8Array>,
  (definition, payload) => {
    if (definition.id !== 3) return;
    inputQueue.enqueue({
      type: ResultType.PRESENCE_EVENT_RESULT,
      publicKey: bytesToBase64(payload),
      online: true,
    });
  },
);

registerServerEvent<Uint8Array>(
  PEER_OFFLINE as MessageDefinition<Uint8Array>,
  (definition, payload) => {
    if (definition.id !== 4) return;
    inputQueue.enqueue({
      type: ResultType.PRESENCE_EVENT_RESULT,
      publicKey: bytesToBase64(payload),
      online: false,
    });
  },
);

export function dispatchServerEventPayload<T>(
  definition: MessageDefinition<T>,
  payload: T,
): void {
  const handler = serverEventHandlers.get(definition.id);
  if (!handler) {
    console.warn(
      `[SIMServe][EVT] no server-event handler for message type ${definition.id} (${definition.name})`,
    );
    return;
  }
  handler(definition, payload);
}
