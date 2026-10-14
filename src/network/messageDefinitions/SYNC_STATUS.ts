// src/network/messageDefinitions/SYNC_STATUS.ts

import {
  InvalidPayload,
  MessageCategory,
  MessageDefinition,
  MessageKind,
  PayloadCodec,
  PayloadProtection,
  PeerRole,
} from "../protocol";
import { validateCommand } from "./validateCommand";

import { GetSimsPayloadCodec, type SimDescriptor } from "./GET_SIMS";
import {
  GetConversationsPayloadCodec,
  type WireConversation,
} from "./GET_CONVERSATIONS";
import {
  GetMessagesSummaryPayloadCodec,
  type WireConversationSummary,
} from "./GET_MESSAGES_SUMMARY";

const RESPONSE_KEYS = [
  "GET_SIMS",
  "GET_CONVERSATIONS",
  "GET_MESSAGES_SUMMARY",
] as const;

type ResponseKey = (typeof RESPONSE_KEYS)[number];

export interface SyncStatusResponseData {
  GET_SIMS: SimDescriptor[];
  GET_CONVERSATIONS: WireConversation[];
  GET_MESSAGES_SUMMARY: {
    subscription_ids: number[];
    conversations: WireConversationSummary[];
  };
}

export interface SyncStatusRequest {
  request_id: number;
  created_at: number;
  process_at: number;
  data: Record<string, never>;
}

export interface SyncStatusResponse {
  request_id: number;
  created_at: number;
  process_at: number;
  data: SyncStatusResponseData;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateRequest(data: unknown): Record<string, never> {
  if (!isPlainObject(data)) {
    throw new InvalidPayload("SYNC_STATUS request data must be an object");
  }
  if (Object.keys(data).length !== 0) {
    throw new InvalidPayload("SYNC_STATUS request data must be empty");
  }
  return {};
}

/**
 * Structure check for the composite response. The per-key validation is
 * delegated to the primitive codecs below, exactly as in Python.
 */
function validateResponseStructure(
  data: unknown,
): Record<ResponseKey, unknown> {
  if (!isPlainObject(data)) {
    throw new InvalidPayload("SYNC_STATUS response data must be an object");
  }
  for (const key of RESPONSE_KEYS) {
    if (!(key in data)) {
      throw new InvalidPayload(`SYNC_STATUS response is missing '${key}'`);
    }
  }
  return data as Record<ResponseKey, unknown>;
}

const primitiveCodecs = {
  GET_SIMS: new GetSimsPayloadCodec(),
  GET_CONVERSATIONS: new GetConversationsPayloadCodec(),
  GET_MESSAGES_SUMMARY: new GetMessagesSummaryPayloadCodec(),
} as const;

/**
 * Validate one composite key by round-tripping its data through the
 * primitive codec's `parse`. This preserves every rule the primitive
 * enforces on the wire without duplicating it here.
 */
function validatePrimitive(key: ResponseKey, data: unknown): unknown {
  const bytes = new TextEncoder().encode(
    JSON.stringify({
      request_id: 0,
      created_at: 0,
      process_at: 0,
      data,
    }),
  );
  const parsed = primitiveCodecs[key].parse(PeerRole.CLIENT, bytes);
  return parsed.data;
}

export class SyncStatusPayloadCodec implements PayloadCodec<
  SyncStatusRequest | SyncStatusResponse
> {
  parse(
    peerRole: PeerRole,
    payload: Uint8Array,
  ): SyncStatusRequest | SyncStatusResponse {
    let parsed: unknown;
    try {
      parsed = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(payload),
      );
    } catch {
      throw new InvalidPayload("SYNC_STATUS payload is not valid JSON");
    }
    const envelope = validateCommand(parsed);

    switch (peerRole) {
      case PeerRole.CLIENT: {
        const structure = validateResponseStructure(envelope.data);
        const data: SyncStatusResponseData = {
          GET_SIMS: validatePrimitive(
            "GET_SIMS",
            structure.GET_SIMS,
          ) as SimDescriptor[],
          GET_CONVERSATIONS: validatePrimitive(
            "GET_CONVERSATIONS",
            structure.GET_CONVERSATIONS,
          ) as WireConversation[],
          GET_MESSAGES_SUMMARY: validatePrimitive(
            "GET_MESSAGES_SUMMARY",
            structure.GET_MESSAGES_SUMMARY,
          ) as SyncStatusResponseData["GET_MESSAGES_SUMMARY"],
        };
        return {
          request_id: envelope.request_id,
          created_at: envelope.created_at,
          process_at: envelope.process_at,
          data,
        };
      }
      case PeerRole.SERVE:
        return {
          request_id: envelope.request_id,
          created_at: envelope.created_at,
          process_at: envelope.process_at,
          data: validateRequest(envelope.data),
        };
      default:
        throw new InvalidPayload(`Unsupported peer role: ${peerRole}`);
    }
  }

  serialize(
    peerRole: PeerRole,
    payload: SyncStatusRequest | SyncStatusResponse,
  ): Uint8Array {
    const envelope = validateCommand(payload);

    switch (peerRole) {
      case PeerRole.CLIENT: {
        const wire = {
          request_id: envelope.request_id,
          created_at: envelope.created_at,
          process_at: envelope.process_at,
          data: validateRequest(envelope.data),
        };
        return new TextEncoder().encode(JSON.stringify(wire));
      }
      case PeerRole.SERVE: {
        // The Serve serializer validates the composite structure and then
        // delegates each key to its primitive codec. The client does not
        // currently serialize a SYNC_STATUS response, so this branch is
        // provided for completeness and uses the same round-trip pattern
        // as parse.
        const structure = validateResponseStructure(envelope.data);
        const data: SyncStatusResponseData = {
          GET_SIMS: validatePrimitive(
            "GET_SIMS",
            structure.GET_SIMS,
          ) as SimDescriptor[],
          GET_CONVERSATIONS: validatePrimitive(
            "GET_CONVERSATIONS",
            structure.GET_CONVERSATIONS,
          ) as WireConversation[],
          GET_MESSAGES_SUMMARY: validatePrimitive(
            "GET_MESSAGES_SUMMARY",
            structure.GET_MESSAGES_SUMMARY,
          ) as SyncStatusResponseData["GET_MESSAGES_SUMMARY"],
        };
        const wire = {
          request_id: envelope.request_id,
          created_at: envelope.created_at,
          process_at: envelope.process_at,
          data,
        };
        return new TextEncoder().encode(JSON.stringify(wire));
      }
      default:
        throw new InvalidPayload(`Unsupported peer role: ${peerRole}`);
    }
  }
}

export const SYNC_STATUS: MessageDefinition<
  SyncStatusRequest | SyncStatusResponse
> = {
  id: 1000,
  name: "SYNC_STATUS",
  kind: MessageKind.COMMAND,
  category: MessageCategory.SYSTEM,
  protection: PayloadProtection.ENCRYPTED,
  codec: new SyncStatusPayloadCodec(),
  description:
    "Composite command that returns SIMs, conversations and message summaries in one response.",
};
