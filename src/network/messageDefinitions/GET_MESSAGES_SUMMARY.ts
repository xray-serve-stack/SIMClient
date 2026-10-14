// src/network/messageDefinitions/GET_MESSAGES_SUMMARY.ts

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

export interface WireConversationSummary {
  number: string;
  message_count: number;
  unread_count: number;
  last_message: number;
}

export interface GetMessagesSummaryRequestData {
  subscription_ids: number[];
}

export interface GetMessagesSummaryResponseData {
  subscription_ids: number[];
  conversations: WireConversationSummary[];
}

export interface GetMessagesSummaryRequest {
  request_id: number;
  created_at: number;
  process_at: number;
  data: GetMessagesSummaryRequestData;
}

export interface GetMessagesSummaryResponse {
  request_id: number;
  created_at: number;
  process_at: number;
  data: GetMessagesSummaryResponseData;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v);
}

function validateSubscriptionIds(value: unknown, label: string): number[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new InvalidPayload(
      `${label} subscription_ids must be a non-empty array`,
    );
  }
  for (const id of value) {
    if (!isInt(id)) {
      throw new InvalidPayload(
        `${label} subscription_ids must contain only integers`,
      );
    }
  }
  return value as number[];
}

function validateRequestData(data: unknown): GetMessagesSummaryRequestData {
  if (!isPlainObject(data)) {
    throw new InvalidPayload(
      "GET_MESSAGES_SUMMARY request data must be an object",
    );
  }
  return {
    subscription_ids: validateSubscriptionIds(
      data["subscription_ids"],
      "GET_MESSAGES_SUMMARY",
    ),
  };
}

function validateConversation(conversation: unknown): WireConversationSummary {
  if (!isPlainObject(conversation)) {
    throw new InvalidPayload(
      "GET_MESSAGES_SUMMARY conversation must be an object",
    );
  }
  const number = conversation["number"];
  if (typeof number !== "string" || number.length < 1) {
    throw new InvalidPayload(
      "GET_MESSAGES_SUMMARY conversation number must be a non-empty string",
    );
  }
  const message_count = conversation["message_count"];
  if (!isInt(message_count) || message_count < 0) {
    throw new InvalidPayload(
      "GET_MESSAGES_SUMMARY conversation message_count must be a non-negative integer",
    );
  }
  const unread_count = conversation["unread_count"];
  if (!isInt(unread_count) || unread_count < 0) {
    throw new InvalidPayload(
      "GET_MESSAGES_SUMMARY conversation unread_count must be a non-negative integer",
    );
  }
  const last_message = conversation["last_message"];
  if (!isInt(last_message) || last_message < 0) {
    throw new InvalidPayload(
      "GET_MESSAGES_SUMMARY conversation last_message must be a non-negative integer",
    );
  }
  return { number, message_count, unread_count, last_message };
}

function validateResponseData(data: unknown): GetMessagesSummaryResponseData {
  if (!isPlainObject(data)) {
    throw new InvalidPayload(
      "GET_MESSAGES_SUMMARY response data must be an object",
    );
  }
  const subscription_ids = validateSubscriptionIds(
    data["subscription_ids"],
    "GET_MESSAGES_SUMMARY response",
  );
  const conversations = data["conversations"];
  if (!Array.isArray(conversations)) {
    throw new InvalidPayload(
      "GET_MESSAGES_SUMMARY response conversations must be an array",
    );
  }
  return {
    subscription_ids,
    conversations: conversations.map(validateConversation),
  };
}

export class GetMessagesSummaryPayloadCodec implements PayloadCodec<
  GetMessagesSummaryRequest | GetMessagesSummaryResponse
> {
  parse(
    peerRole: PeerRole,
    payload: Uint8Array,
  ): GetMessagesSummaryRequest | GetMessagesSummaryResponse {
    let parsed: unknown;
    try {
      parsed = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(payload),
      );
    } catch {
      throw new InvalidPayload(
        "GET_MESSAGES_SUMMARY payload is not valid JSON",
      );
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
    payload: GetMessagesSummaryRequest | GetMessagesSummaryResponse,
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

export const GET_MESSAGES_SUMMARY: MessageDefinition<
  GetMessagesSummaryRequest | GetMessagesSummaryResponse
> = {
  id: 14,
  name: "GET_MESSAGES_SUMMARY",
  kind: MessageKind.COMMAND,
  category: MessageCategory.SMS,
  protection: PayloadProtection.ENCRYPTED,
  codec: new GetMessagesSummaryPayloadCodec(),
  description: "Request a summary of SMS messages from the Serve.",
};
