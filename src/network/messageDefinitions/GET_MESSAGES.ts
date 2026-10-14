// src/network/messageDefinitions/GET_MESSAGES.ts

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

const MESSAGE_TYPE_MIN = 1;
const MESSAGE_TYPE_MAX = 6;

export interface WireMessage {
  body: string;
  timestamp: number;
  subscription_id: number;
  type: number;
}

export interface GetMessagesRequestData {
  subscription_ids: number[];
  number: string;
  start?: number | null;
  end?: number | null;
  cached_count?: number | null;
  limit?: number | null;
}

export interface GetMessagesResponseData {
  messages: WireMessage[];
  remaining: number;
  next_start: number | null;
}

export interface GetMessagesRequest {
  request_id: number;
  created_at: number;
  process_at: number;
  data: GetMessagesRequestData;
}

export interface GetMessagesResponse {
  request_id: number;
  created_at: number;
  process_at: number;
  data: GetMessagesResponseData;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v);
}

function validateRequestData(data: unknown): GetMessagesRequestData {
  if (!isPlainObject(data)) {
    throw new InvalidPayload("GET_MESSAGES request data must be an object");
  }

  const subscription_ids = data["subscription_ids"];
  if (!Array.isArray(subscription_ids) || subscription_ids.length === 0) {
    throw new InvalidPayload(
      "GET_MESSAGES subscription_ids must be a non-empty array",
    );
  }
  for (const id of subscription_ids) {
    if (!isInt(id)) {
      throw new InvalidPayload(
        "GET_MESSAGES subscription_ids must contain only integers",
      );
    }
  }

  const number = data["number"];
  if (typeof number !== "string" || number.length < 1) {
    throw new InvalidPayload("GET_MESSAGES number must be a non-empty string");
  }

  const start = data["start"] ?? null;
  const end = data["end"] ?? null;
  if (start !== null && !isInt(start)) {
    throw new InvalidPayload("GET_MESSAGES start must be an integer or null");
  }
  if (end !== null && !isInt(end)) {
    throw new InvalidPayload("GET_MESSAGES end must be an integer or null");
  }
  if (start !== null && end !== null && start > end) {
    throw new InvalidPayload(
      "GET_MESSAGES start must be less than or equal to end",
    );
  }

  const cached_count = data["cached_count"] ?? null;
  if (cached_count !== null && (!isInt(cached_count) || cached_count < 0)) {
    throw new InvalidPayload(
      "GET_MESSAGES cached_count must be a non-negative integer or null",
    );
  }

  const limit = data["limit"] ?? null;
  if (limit !== null && (!isInt(limit) || limit <= 0)) {
    throw new InvalidPayload(
      "GET_MESSAGES limit must be a positive integer or null",
    );
  }

  return {
    subscription_ids: subscription_ids as number[],
    number,
    start,
    end,
    cached_count,
    limit,
  };
}

function validateMessage(message: unknown): WireMessage {
  if (!isPlainObject(message)) {
    throw new InvalidPayload("GET_MESSAGES message must be an object");
  }
  const body = message["body"];
  if (typeof body !== "string") {
    throw new InvalidPayload("GET_MESSAGES message body must be a string");
  }
  const timestamp = message["timestamp"];
  if (!isInt(timestamp) || timestamp < 0) {
    throw new InvalidPayload(
      "GET_MESSAGES message timestamp must be a non-negative integer",
    );
  }
  const subscription_id = message["subscription_id"];
  if (!isInt(subscription_id)) {
    throw new InvalidPayload(
      "GET_MESSAGES message subscription_id must be an integer",
    );
  }
  const type = message["type"];
  if (!isInt(type)) {
    throw new InvalidPayload("GET_MESSAGES message type must be an integer");
  }
  if (type < MESSAGE_TYPE_MIN || type > MESSAGE_TYPE_MAX) {
    throw new InvalidPayload(
      `GET_MESSAGES message type must be in range ${MESSAGE_TYPE_MIN}..${MESSAGE_TYPE_MAX}`,
    );
  }
  return { body, timestamp, subscription_id, type };
}

function validateResponseData(data: unknown): GetMessagesResponseData {
  if (!isPlainObject(data)) {
    throw new InvalidPayload("GET_MESSAGES response data must be an object");
  }
  const messages = data["messages"];
  if (!Array.isArray(messages)) {
    throw new InvalidPayload("GET_MESSAGES messages must be an array");
  }
  const remaining = data["remaining"];
  if (!isInt(remaining) || remaining < 0) {
    throw new InvalidPayload(
      "GET_MESSAGES remaining must be a non-negative integer",
    );
  }
  const next_start = data["next_start"] ?? null;
  if (next_start !== null && (!isInt(next_start) || next_start < 0)) {
    throw new InvalidPayload(
      "GET_MESSAGES next_start must be a non-negative integer or null",
    );
  }
  return {
    messages: messages.map(validateMessage),
    remaining,
    next_start,
  };
}

export class GetMessagesPayloadCodec implements PayloadCodec<
  GetMessagesRequest | GetMessagesResponse
> {
  parse(
    peerRole: PeerRole,
    payload: Uint8Array,
  ): GetMessagesRequest | GetMessagesResponse {
    let parsed: unknown;
    try {
      parsed = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(payload),
      );
    } catch {
      throw new InvalidPayload("GET_MESSAGES payload is not valid JSON");
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
    payload: GetMessagesRequest | GetMessagesResponse,
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

export const GET_MESSAGES: MessageDefinition<
  GetMessagesRequest | GetMessagesResponse
> = {
  id: 13,
  name: "GET_MESSAGES",
  kind: MessageKind.COMMAND,
  category: MessageCategory.SMS,
  protection: PayloadProtection.ENCRYPTED,
  codec: new GetMessagesPayloadCodec(),
  description: "Request SMS messages from the Serve.",
};
