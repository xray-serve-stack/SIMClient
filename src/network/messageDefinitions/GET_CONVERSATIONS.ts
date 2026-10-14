// src/network/messageDefinitions/GET_CONVERSATIONS.ts

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

/**
 * Response item, one per conversation.
 *
 * Python fields:
 *   number:         non-empty string
 *   message_count:  non-negative integer
 *   last_message:   non-negative integer (epoch ms)
 *   preview:        string, at most 100 characters
 */
export interface WireConversation {
  number: string;
  message_count: number;
  last_message: number;
  preview: string;
}

export interface GetConversationsRequest {
  request_id: number;
  created_at: number;
  process_at: number;
  data: { subscription_ids: number[] };
}

export interface GetConversationsResponse {
  request_id: number;
  created_at: number;
  process_at: number;
  data: WireConversation[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v);
}

function validateRequestData(data: unknown): { subscription_ids: number[] } {
  if (!isPlainObject(data)) {
    throw new InvalidPayload(
      "GET_CONVERSATIONS request data must be an object",
    );
  }
  const subscription_ids = data["subscription_ids"];
  if (!Array.isArray(subscription_ids) || subscription_ids.length === 0) {
    throw new InvalidPayload(
      "GET_CONVERSATIONS subscription_ids must be a non-empty list",
    );
  }
  for (const id of subscription_ids) {
    if (!isInt(id)) {
      throw new InvalidPayload(
        "GET_CONVERSATIONS subscription_ids values must be integers",
      );
    }
  }
  return { subscription_ids: subscription_ids as number[] };
}

function validateResponseData(data: unknown): WireConversation[] {
  if (!Array.isArray(data)) {
    throw new InvalidPayload("GET_CONVERSATIONS response data must be a list");
  }
  return data.map((item) => {
    if (!isPlainObject(item)) {
      throw new InvalidPayload(
        "GET_CONVERSATIONS conversation must be an object",
      );
    }
    const number = item["number"];
    if (typeof number !== "string" || number.length < 1) {
      throw new InvalidPayload(
        "GET_CONVERSATIONS number must be a non-empty string",
      );
    }
    const message_count = item["message_count"];
    if (!isInt(message_count) || message_count < 0) {
      throw new InvalidPayload(
        "GET_CONVERSATIONS message_count must be a non-negative integer",
      );
    }
    const last_message = item["last_message"];
    if (!isInt(last_message) || last_message < 0) {
      throw new InvalidPayload(
        "GET_CONVERSATIONS last_message must be a non-negative integer",
      );
    }
    const preview = item["preview"];
    if (typeof preview !== "string" || preview.length > 100) {
      throw new InvalidPayload(
        "GET_CONVERSATIONS preview must be a string of at most 100 characters",
      );
    }
    return { number, message_count, last_message, preview };
  });
}

export class GetConversationsPayloadCodec implements PayloadCodec<
  GetConversationsRequest | GetConversationsResponse
> {
  parse(
    peerRole: PeerRole,
    payload: Uint8Array,
  ): GetConversationsRequest | GetConversationsResponse {
    let parsed: unknown;
    try {
      parsed = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(payload),
      );
    } catch {
      throw new InvalidPayload("GET_CONVERSATIONS payload is not valid JSON");
    }
    const envelope = validateCommand(parsed);

    switch (peerRole) {
      case PeerRole.CLIENT:
        return {
          request_id: envelope.request_id,
          created_at: envelope.created_at,
          process_at: envelope.process_at,
          data: validateResponseData(envelope.data),
        };
      case PeerRole.SERVE:
        return {
          request_id: envelope.request_id,
          created_at: envelope.created_at,
          process_at: envelope.process_at,
          data: validateRequestData(envelope.data),
        };
      default:
        throw new InvalidPayload(`Unsupported peer role: ${peerRole}`);
    }
  }

  serialize(
    peerRole: PeerRole,
    payload: GetConversationsRequest | GetConversationsResponse,
  ): Uint8Array {
    const envelope = validateCommand(payload);

    switch (peerRole) {
      case PeerRole.CLIENT: {
        const wire = {
          request_id: envelope.request_id,
          created_at: envelope.created_at,
          process_at: envelope.process_at,
          data: validateRequestData(envelope.data),
        };
        return new TextEncoder().encode(JSON.stringify(wire));
      }
      case PeerRole.SERVE: {
        const wire = {
          request_id: envelope.request_id,
          created_at: envelope.created_at,
          process_at: envelope.process_at,
          data: validateResponseData(envelope.data),
        };
        return new TextEncoder().encode(JSON.stringify(wire));
      }
      default:
        throw new InvalidPayload(`Unsupported peer role: ${peerRole}`);
    }
  }
}

export const GET_CONVERSATIONS: MessageDefinition<
  GetConversationsRequest | GetConversationsResponse
> = {
  id: 12,
  name: "GET_CONVERSATIONS",
  kind: MessageKind.COMMAND,
  category: MessageCategory.CONVERSATION,
  protection: PayloadProtection.ENCRYPTED,
  codec: new GetConversationsPayloadCodec(),
  description: "Request conversations from the Serve.",
};
