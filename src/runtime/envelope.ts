// src/runtime/envelope.ts

/**
 * Shared command envelope for every outbound COMMAND that crosses the WSS
 * boundary.
 *
 * This is the ONLY place in the client where `request_id`, `created_at`
 * and `process_at` are produced. Handlers must not construct them.
 *
 * Contract (from Python `VALIDATE_COMMANDS.validate_command`):
 *   - request_id: integer, unique within the session
 *   - created_at: integer, epoch milliseconds, time the request was built
 *   - process_at: integer, NOT nullable. The client sets it to 0 for
 *     outbound requests; the server overwrites it when it processes the
 *     command and returns the response.
 *   - data:       command-specific payload
 *
 * The `command` field is not part of the wire envelope; the message type
 * is carried in the packet header, not in the JSON.
 */

export interface RequestEnvelope<TData = unknown> {
  request_id: number;
  created_at: number;
  process_at: number;
  data: TData;
}

let counter = 0;

/**
 * Monotonically increasing per-session request id. Starts at 1 on the
 * first call after page load. Resets on reload.
 */
export function nextRequestId(): number {
  counter += 1;
  return counter;
}

/**
 * Build an outbound command envelope around the given data.
 *
 * `process_at` is 0 here. The Python validator requires it to be an
 * integer and rejects null, so 0 is used as the client-side sentinel for
 * "not yet processed". The server sets the real value in the response.
 */
export function buildEnvelope<TData>(data: TData): RequestEnvelope<TData> {
  return {
    request_id: nextRequestId(),
    created_at: Date.now(),
    process_at: 0,
    data,
  };
}
