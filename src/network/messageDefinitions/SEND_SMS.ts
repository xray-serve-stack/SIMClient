// src/network/messageDefinitions/SEND_SMS.ts

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

export interface SendSmsRequestData {
  subscription_id: number;
  number: string;
  body: string;
}

export interface SendSmsResponseData {
  accepted: boolean;
  reason?: string;
}

export interface SendSmsRequest {
  request_id: number;
  created_at: number;
  process_at: number;
  data: SendSmsRequestData;
}

export interface SendSmsResponse {
  request_id: number;
  created_at: number;
  process_at: number;
  data: SendSmsResponseData;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateRequestData(data: unknown): SendSmsRequestData {
  if (!isPlainObject(data)) {
    throw new InvalidPayload("SEND_SMS request data must be an object");
  }
  const subscription_id = data["subscription_id"];
  if (
    typeof subscription_id !== "number" ||
    !Number.isInteger(subscription_id)
  ) {
    throw new InvalidPayload("SEND_SMS subscription_id must be an integer");
  }
  const number = data["number"];
  if (typeof number !== "string" || number.length === 0) {
    throw new InvalidPayload("SEND_SMS number must be a non-empty string");
  }
  const body = data["body"];
  if (typeof body !== "string" || body.length === 0) {
    throw new InvalidPayload("SEND_SMS body must be a non-empty string");
  }
  return { subscription_id, number, body };
}

function validateResponseData(data: unknown): SendSmsResponseData {
  if (!isPlainObject(data)) {
    throw new InvalidPayload("SEND_SMS response data must be an object");
  }
  const accepted = data["accepted"];
  if (typeof accepted !== "boolean") {
    throw new InvalidPayload("SEND_SMS response accepted must be a boolean");
  }
  if (accepted === false) {
    const reason = data["reason"];
    if (typeof reason !== "string") {
      throw new InvalidPayload(
        "SEND_SMS response reason must be a string when accepted is false",
      );
    }
    return { accepted, reason };
  }
  return { accepted };
}

export class SendSmsPayloadCodec implements PayloadCodec<
  SendSmsRequest | SendSmsResponse
> {
  parse(
    peerRole: PeerRole,
    payload: Uint8Array,
  ): SendSmsRequest | SendSmsResponse {
    let parsed: unknown;
    try {
      parsed = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(payload),
      );
    } catch {
      throw new InvalidPayload("SEND_SMS payload is not valid JSON");
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
    payload: SendSmsRequest | SendSmsResponse,
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

export const SEND_SMS: MessageDefinition<SendSmsRequest | SendSmsResponse> = {
  id: 15,
  name: "SEND_SMS",
  kind: MessageKind.COMMAND,
  category: MessageCategory.SMS,
  protection: PayloadProtection.ENCRYPTED,
  codec: new SendSmsPayloadCodec(),
  description: "Send a single-part SMS message from the Serve.",
};
