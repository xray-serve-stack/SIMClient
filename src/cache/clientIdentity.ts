import { x25519 } from "@noble/curves/ed25519.js";
import { getMeta, setMeta } from "./chatRepository";

export interface ClientIdentity {
  /** X25519 private key, 32 bytes, stored as Base64. */
  privateKeyB64: string;
  /** X25519 public key, 32 bytes, stored as Base64. */
  publicKeyB64: string;
}

// ---------------------------------------------------------------------------
// Base64 helpers
//
// We use explicit helpers so that the encode/decode path is testable and we
// never rely on implicit string coercion of crypto bytes.
// ---------------------------------------------------------------------------

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// Meta-backed identity persistence
// ---------------------------------------------------------------------------

export async function getClientIdentity(): Promise<ClientIdentity | undefined> {
  const [publicKeyB64, privateKeyB64] = await Promise.all([
    getMeta<string>("CLIENT_PUBLIC_KEY"),
    getMeta<string>("CLIENT_PRIVATE_KEY"),
  ]);
  if (!publicKeyB64 || !privateKeyB64) return undefined;
  return { publicKeyB64, privateKeyB64 };
}

export async function saveClientIdentity(
  identity: ClientIdentity,
): Promise<void> {
  // Two meta writes. Both are one-time (or rare) operations, so the cost of
  // two transactions is negligible. If the browser crashes between them,
  // `getClientIdentity` returns undefined on the next load and a fresh
  // keypair is generated — a benign failure mode for a pre-network client.
  await setMeta<string>("CLIENT_PUBLIC_KEY", identity.publicKeyB64);
  await setMeta<string>("CLIENT_PRIVATE_KEY", identity.privateKeyB64);
}

// ---------------------------------------------------------------------------
// Keypair generation + initialization
// ---------------------------------------------------------------------------

/**
 * Generate a fresh X25519 keypair.
 *
 * The generated public key is 32 bytes, so its Base64 form is 44 chars
 * including padding. The private key is 32 bytes as well.
 */
export function generateClientIdentity(): ClientIdentity {
  const { secretKey, publicKey } = x25519.keygen();
  return {
    privateKeyB64: bytesToBase64(secretKey),
    publicKeyB64: bytesToBase64(publicKey),
  };
}

// ---------------------------------------------------------------------------
// Canonical load-or-create entry point
// ---------------------------------------------------------------------------

/**
 * Load-or-create the client identity.
 *
 * This is the ONLY function that generates client keys. Every other code
 * path — including RemoteConnection.init() — must go through here so a
 * device's identity is stable across startups and across callers.
 */
export async function getOrCreateClientIdentity(): Promise<ClientIdentity> {
  const existing = await getClientIdentity();
  if (existing) return existing;

  const fresh = generateClientIdentity();
  await saveClientIdentity(fresh);
  return fresh;
}

/**
 * @deprecated Use getOrCreateClientIdentity().
 * Retained as a re-export so existing callers (initializeClient.ts) do not
 * need to change in this task. Remove once all callers are migrated.
 */
export const initializeClientIdentity = getOrCreateClientIdentity;

// ---------------------------------------------------------------------------
// Shared secret primitive
//
// Provided as a foundation for the future E2E protocol. No HKDF, AEAD, framing,
// or session management is implemented here.
// ---------------------------------------------------------------------------

/**
 * X25519 Diffie-Hellman. Returns the raw 32-byte shared secret.
 *
 * Both sides must agree: Alice(privateA, publicB) === Bob(privateB, publicA).
 */
export function deriveSharedSecret(
  privateKey: Uint8Array,
  remotePublicKey: Uint8Array,
): Uint8Array {
  return x25519.getSharedSecret(privateKey, remotePublicKey);
}
