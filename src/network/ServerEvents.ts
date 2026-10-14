/**
 * Server-originated events.
 *
 * A packet whose `peer` equals the reserved ZERO key is a server event, not
 * an application message. The allowed server-event message types are fixed
 * by the protocol:
 *
 *     0, 2, 3, 4, 5, 6, 7, 8, 9
 *
 * Type 1 (AUTHENTICATE) is NOT a server event; it is handled by the
 * authentication path before any application routing.
 *
 * GET_SIMS (11) is NOT a server event.
 */

import { MessageRegistry } from "./MessageRegistry";

export const ALLOWED_SERVER_EVENT_IDS: ReadonlySet<number> = new Set([
  0, 2, 3, 4, 5, 6, 7, 8, 9,
]);

export function isAllowedServerEvent(messageType: number): boolean {
  if (!ALLOWED_SERVER_EVENT_IDS.has(messageType)) return false;
  // Only dispatch events that are actually registered. An unknown id in the
  // allowed range is ignored rather than treated as a protocol error.
  return MessageRegistry.has(messageType);
}
