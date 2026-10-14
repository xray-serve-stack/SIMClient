// src/store/simsHelpers.ts

import type { Sim } from "@/types";

/**
 * Pure SIM-selection helpers.
 *
 * These functions take the current SIM list as an argument and never
 * query IndexedDB or the store. They exist so the same default-selection
 * and ordinal-mapping rules are not re-implemented at each call site.
 */

/**
 * Return the SIM that should be used for sending when no per-conversation
 * override exists.
 *
 * Policy:
 *   1. If exactly one SIM has `is_default_sms === true`, that SIM.
 *   2. If multiple have it, the first in `sims` order.
 *   3. If none has it, `sims[0]`.
 *   4. If the list is empty, `undefined`.
 *
 * The list is NOT reordered and NOT mutated.
 */
export function getDefaultSim(sims: readonly Sim[]): Sim | undefined {
  if (sims.length === 0) return undefined;
  const flagged = sims.find((s) => s.is_default_sms === true);
  return flagged ?? sims[0];
}

/**
 * Return a new array with the default SIM first and the remaining SIMs in
 * their existing relative order. The input array is not mutated.
 *
 * Returns the same array (not a copy) when the list is empty or already
 * correctly ordered.
 */
export function simsInUiOrder(sims: readonly Sim[]): Sim[] {
  const def = getDefaultSim(sims);
  if (!def) return [...sims];
  if (sims[0] === def) return [...sims];
  return [def, ...sims.filter((s) => s !== def)];
}

/**
 * Map a `subscription_id` to the ordinal of the matching SIM in the
 * current list, or `undefined` if the SIM is not present.
 */
export function subscriptionIdToOrdinal(
  sims: readonly Sim[],
  subscription_id: number,
): number | undefined {
  return sims.find((s) => s.subscription_id === subscription_id)?.ordinal;
}

/**
 * Map an ordinal to the corresponding `subscription_id`, or `undefined`
 * if no SIM has that ordinal.
 */
export function ordinalToSubscriptionId(
  sims: readonly Sim[],
  ordinal: number,
): number | undefined {
  return sims.find((s) => s.ordinal === ordinal)?.subscription_id;
}
