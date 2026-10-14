// src/runtime/handlers/types.ts

import type { Command } from "@/runtime/commands";
import type { Result } from "@/runtime/results";

/**
 * One outbound network request described by a handler.
 *
 * `messageType` is a MessageDefinition.id (e.g. GET_SIMS.id). The worker
 * resolves nothing; it forwards `messageType` and a freshly built envelope
 * around `data` to `RemoteConnection.sendApplication`.
 *
 * `data` is the `data` field of the wire envelope. It is typed `unknown`
 * because the shape is message-specific and the worker is generic. The
 * codec for `messageType` is the type boundary.
 */
export interface NetworkRequest {
  messageType: number;
  data: unknown;
  /**
   * Optional destination override. When set, the worker sends the packet
   * to this raw peer instead of the current Serve. Used by WATCH_PEERS.
   */
  peerOverride?: Uint8Array;
  /**
   * When true, `data` is the codec payload exactly as the codec expects
   * it. The worker does NOT wrap it in a RequestEnvelope. Used by raw
   * binary protocol messages such as WATCH_PEERS whose codec is not a
   * JSON command envelope.
   *
   * When false or absent, `data` is the command `data` field and the
   * worker wraps it via `buildEnvelope(data)`.
   */
  raw?: boolean;
}

/**
 * The complete set of intended side effects a handler wants the worker to
 * perform on its behalf.
 *
 *   - `results` are enqueued into InputQueue in order.
 *   - `sends`   are dispatched to RemoteConnection in order, each wrapped
 *               in a fresh envelope via `buildEnvelope(data)`.
 *
 * Handlers must not import `inputQueue`, `remoteConnection`, or
 * `runtime/envelope`. They return descriptions; the worker performs.
 */
export interface OutputWorkerResult {
  results: Result[];
  sends: NetworkRequest[];
}

/**
 * A CommandHandler owns the execution logic for exactly one CommandType.
 *
 * Contract:
 *   - `execute` performs local work only (cache reads, DB writes).
 *   - `execute` returns an `OutputWorkerResult` describing the results to
 *     publish and the network requests to send.
 *   - `execute` may throw. OutputWorker catches and converts thrown errors
 *     into an OPERATION_FAILED_RESULT so nothing is lost.
 *
 * Handlers that need no network activity return `sends: []`.
 */
export interface CommandHandler<TCommand extends Command = Command> {
  execute(command: TCommand): Promise<OutputWorkerResult>;
}
