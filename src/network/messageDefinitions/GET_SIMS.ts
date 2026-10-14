// src/network/messageDefinitions/GET_SIMS.ts

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

import type { SimDescriptor } from "@/types";

/**
 * Required fields, and the exact runtime type each must have.
 *
 *   - "number"          -> typeof value === "number"
 *   - "nullable-string" -> value === null || typeof value === "string"
 *   - "nullable-number" -> value === null || typeof value === "number"
 *   - "boolean"         -> typeof value === "boolean"
 */
const SIM_FIELD_SPEC: ReadonlyArray<
  | readonly [keyof SimDescriptor, "number"]
  | readonly [keyof SimDescriptor, "nullable-string"]
  | readonly [keyof SimDescriptor, "nullable-number"]
  | readonly [keyof SimDescriptor, "boolean"]
> = [
  ["subscription_id", "number"],
  ["slot_index", "number"],
  ["number", "nullable-string"],
  ["carrier_name", "nullable-string"],
  ["display_name", "nullable-string"],
  ["country_iso", "nullable-string"],
  ["mcc", "nullable-number"],
  ["mnc", "nullable-number"],
  ["is_default_sms", "boolean"],
];

export type { SimDescriptor };

export interface GetSimsRequest {
  request_id: number;
  created_at: number;
  process_at: number;
  data: Record<string, never>;
}

export interface GetSimsResponse {
  request_id: number;
  created_at: number;
  process_at: number;
  data: SimDescriptor[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateRequestData(data: unknown): Record<string, never> {
  if (!isPlainObject(data)) {
    throw new InvalidPayload("GET_SIMS request data must be an object");
  }
  if (Object.keys(data).length !== 0) {
    throw new InvalidPayload("GET_SIMS request data must be empty");
  }
  return {} as Record<string, never>;
}

function validateResponseData(data: unknown): SimDescriptor[] {
  if (!Array.isArray(data)) {
    throw new InvalidPayload("GET_SIMS response data must be an array");
  }
  return data.map((sim, index) => {
    if (!isPlainObject(sim)) {
      throw new InvalidPayload(
        `GET_SIMS response item ${index} must be an object`,
      );
    }
    for (const [field, kind] of SIM_FIELD_SPEC) {
      const value = sim[field as string];
      switch (kind) {
        case "number":
          if (typeof value !== "number" || !Number.isFinite(value)) {
            throw new InvalidPayload(
              `GET_SIMS field "${String(field)}" on item ${index} must be a number`,
            );
          }
          break;
        case "nullable-string":
          if (value !== null && typeof value !== "string") {
            throw new InvalidPayload(
              `GET_SIMS field "${String(field)}" on item ${index} must be a string or null`,
            );
          }
          break;
        case "nullable-number":
          if (
            value !== null &&
            (typeof value !== "number" || !Number.isFinite(value))
          ) {
            throw new InvalidPayload(
              `GET_SIMS field "${String(field)}" on item ${index} must be a number or null`,
            );
          }
          break;
        case "boolean":
          if (typeof value !== "boolean") {
            throw new InvalidPayload(
              `GET_SIMS field "${String(field)}" on item ${index} must be a boolean`,
            );
          }
          break;
      }
    }
    return {
      subscription_id: sim["subscription_id"] as number,
      slot_index: sim["slot_index"] as number,
      number: sim["number"] as string | null,
      carrier_name: sim["carrier_name"] as string | null,
      display_name: sim["display_name"] as string | null,
      country_iso: sim["country_iso"] as string | null,
      mcc: sim["mcc"] as number | null,
      mnc: sim["mnc"] as number | null,
      is_default_sms: sim["is_default_sms"] as boolean,
    };
  });
}

/**
 * The GET_SIMS codec. Direction is decided by `peer_role`, exactly as in
 * the Python source: CLIENT parses a response (array) and serializes a
 * request (empty object); SERVE is the mirror.
 */
export class GetSimsPayloadCodec implements PayloadCodec<
  GetSimsRequest | GetSimsResponse
> {
  parse(
    peerRole: PeerRole,
    payload: Uint8Array,
  ): GetSimsRequest | GetSimsResponse {
    let parsed: unknown;
    try {
      parsed = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(payload),
      );
    } catch {
      throw new InvalidPayload("GET_SIMS payload is not valid JSON");
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
    payload: GetSimsRequest | GetSimsResponse,
  ): Uint8Array {
    const envelope = validateCommand(payload);

    switch (peerRole) {
      case PeerRole.CLIENT: {
        const data = validateRequestData(envelope.data);
        const wire = {
          request_id: envelope.request_id,
          created_at: envelope.created_at,
          process_at: envelope.process_at,
          data,
        };
        return new TextEncoder().encode(JSON.stringify(wire));
      }
      case PeerRole.SERVE: {
        const data = validateResponseData(envelope.data);
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

export const GET_SIMS: MessageDefinition<GetSimsRequest | GetSimsResponse> = {
  id: 11,
  name: "GET_SIMS",
  kind: MessageKind.COMMAND,
  category: MessageCategory.SIM,
  protection: PayloadProtection.ENCRYPTED,
  codec: new GetSimsPayloadCodec(),
  description: "Request the active SIM subscriptions from the Serve.",
};
