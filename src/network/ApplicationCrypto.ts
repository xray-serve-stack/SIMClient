/**
 * ApplicationCrypto — thin adapter from a cached shared-secret CryptoKey to
 * the encrypt/decrypt callables that `PayloadPipeline` expects.
 *
 * This module is intentionally small. It does NOT re-derive keys and does
 * NOT contain a second crypto implementation. It only:
 *
 *   - asks `SharedSecretCache` for the AES key for a given peer public key
 *   - builds the fixed application AAD: "SIMServe-v1"
 *   - calls the AES-GCM primitives from `Crypto.ts`
 *
 * The AAD is CONSTANT. It is NOT derived from the message type and NOT
 * derived from the MessageDefinition id. The message type / registry lookup
 * is the mechanism that identifies which codec to use; the AAD is purely
 * cryptographic context.
 *
 * The same AES-GCM wire format is used as in `Crypto.ts`:
 *   nonce (12) || ciphertext || tag (16)
 */

import {
  AES_KEY_SIZE,
  GCM_NONCE_SIZE,
  GCM_TAG_SIZE,
  decryptWithKey,
  encryptWithKey,
} from "./Crypto";

export const APPLICATION_AAD = new TextEncoder().encode("SIMServe-v1");

if (APPLICATION_AAD.length !== "SIMServe-v1".length) {
  // Compile-time style guard: TextEncoder always produces UTF-8, but this
  // makes the constant's length explicit and fails loudly if the string is
  // ever changed to a non-ASCII value.
  throw new Error('APPLICATION_AAD must be the UTF-8 bytes of "SIMServe-v1"');
}

export function makeEncrypt(
  key: CryptoKey,
): (plaintext: Uint8Array) => Promise<Uint8Array> {
  return (plaintext) => encryptWithKey(key, plaintext, APPLICATION_AAD);
}

export function makeDecrypt(
  key: CryptoKey,
): (ciphertext: Uint8Array) => Promise<Uint8Array> {
  return (ciphertext) => decryptWithKey(key, ciphertext, APPLICATION_AAD);
}

// Re-export the constants used by the wire format so callers have a single
// place to look.
export { AES_KEY_SIZE, GCM_NONCE_SIZE, GCM_TAG_SIZE };
