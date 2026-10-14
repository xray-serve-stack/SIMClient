// src/network/messageDefinitions/validateCommand.ts

import { InvalidPayload } from "../protocol";

/**
 * Structural envelope for COMMAND payloads.
 *
 * Direct TypeScript port of the Python `VALIDATE_COMMANDS.validate_command`.
 *
 * Contract (from Python):
 *   - payload must be a JSON object (not null, not array)
 *   - must contain exactly the required keys: request_id, created_at,
 *     process_at, data
 *   - request_id, created_at, process_at must each be an integer
 *   - process_at is NOT nullable. The client sets it to 0 on outbound
 *     requests; the server overwrites it on responses.
 *
 * The `command` field is NOT part of this envelope and must not be present.
 */
export interface CommandEnvelope<TData = unknown> {
  request_id: number;
  created_at: number;
  process_at: number;
  data: TData;
}

const REQUIRED_KEYS = [
  "request_id",
  "created_at",
  "process_at",
  "data",
] as const;

export function validateCommand<TData = unknown>(
  payload: unknown,
): CommandEnvelope<TData> {
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    throw new InvalidPayload("Command payload must be a JSON object");
  }

  const obj = payload as Record<string, unknown>;

  const missing: string[] = [];
  for (const key of REQUIRED_KEYS) {
    if (!(key in obj)) missing.push(key);
  }
  if (missing.length > 0) {
    throw new InvalidPayload(
      `Command payload is missing required keys: ${missing.join(", ")}`,
    );
  }

  const request_id = obj["request_id"];
  if (typeof request_id !== "number" || !Number.isInteger(request_id)) {
    throw new InvalidPayload("request_id must be an integer");
  }

  const created_at = obj["created_at"];
  if (typeof created_at !== "number" || !Number.isInteger(created_at)) {
    throw new InvalidPayload("created_at must be an integer");
  }

  const process_at = obj["process_at"];
  if (typeof process_at !== "number" || !Number.isInteger(process_at)) {
    throw new InvalidPayload("process_at must be an integer");
  }

  return {
    request_id,
    created_at,
    process_at,
    data: obj["data"] as TData,
  };
}
