/**
 * Client-side handshake crypto.
 *
 * This file is the Client counterpart of the Python Server's `crypto.py`.
 * Every parameter below is taken directly from that file; do not change any
 * of them without also changing the Server.
 *
 * Contract:
 *
 *   X25519
 *     private key : 32 bytes
 *     public key  : 32 bytes
 *
 *   HKDF
 *     hash        : SHA-256
 *     salt        : empty (b"")
 *     info        : UTF-8 "SIMServe-v1"
 *     output      : 32 bytes (AES-256 key)
 *
 *   AES-GCM
 *     key         : 32 bytes (HKDF output)
 *     nonce       : 12 bytes, random per encryption
 *     tag         : 16 bytes (128 bits)
 *
 *   Encrypted wire format
 *     nonce (12) || ciphertext || tag (16)
 *
 *   AAD
 *     The packet's `message_type` encoded as an 8-byte big-endian uint64.
 *     Reconstructed by the caller from the received Packet header.
 *
 * HKDF `info` and AES-GCM `AAD` are DIFFERENT values. Do not conflate them.
 */

import { x25519 } from "@noble/curves/ed25519.js";

/** 32 zero bytes. Used as the Packet peer for Client -> Server messages. */
export const RESERVED_KEY = new Uint8Array(32);

/** HKDF info string. Must match the Python Server's `HKDF_INFO`. */
export const HKDF_INFO = new TextEncoder().encode("SIMServe-v1");

/** HKDF salt. Empty, matching the Python Server's `HKDF_SALT = b""`. */
export const HKDF_SALT = new Uint8Array(0);

/** AES-256 key length in bytes. */
export const AES_KEY_SIZE = 32;

/** AES-GCM nonce length in bytes. */
export const GCM_NONCE_SIZE = 12;

/** AES-GCM authentication tag length in bytes. */
export const GCM_TAG_SIZE = 16;

/** Plaintext nonce length in bytes. */
export const CHALLENGE_SIZE = 32;

/**
 * Copy a Uint8Array into a fresh, non-shared ArrayBuffer.
 *
 * TypeScript 5.7+ types Uint8Array.buffer as ArrayBufferLike, which may
 * include SharedArrayBuffer. Web Crypto requires ArrayBuffer. A slice()
 * produces a fresh, non-shared buffer.
 */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer;
}

/**
 * Derive the AES-256-GCM handshake key.
 *
 * Matches the Python Server's `derive_peer_key`:
 *
 *   shared_secret = X25519(client_private, server_public)
 *   aes_key       = HKDF-SHA256(
 *                     ikm  = shared_secret,
 *                     salt = b"",
 *                     info = b"SIMServe-v1",
 *                     len  = 32,
 *                   )
 *
 * The returned CryptoKey is used for a single handshake and is not persisted.
 */
export async function derivePeerKey(
  privateKey: Uint8Array,
  peerPublicKey: Uint8Array,
): Promise<CryptoKey> {
  if (privateKey.length !== 32) {
    throw new Error("Private key must be 32 bytes");
  }

  if (peerPublicKey.length !== 32) {
    throw new Error("Public key must be 32 bytes");
  }

  const sharedSecret = x25519.getSharedSecret(privateKey, peerPublicKey);

  const sharedSecretKey = await crypto.subtle.importKey(
    "raw",
    sharedSecret,
    "HKDF",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: HKDF_SALT,
      info: HKDF_INFO,
    },
    sharedSecretKey,
    {
      name: "AES-GCM",
      length: AES_KEY_SIZE * 8,
    },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * AES-256-GCM encrypt with the handshake key.
 *
 * Output wire format:
 *
 *   nonce (12 bytes) || ciphertext || tag (16 bytes)
 *
 * `aad` is the packet's message type as an 8-byte big-endian uint64.
 */
export async function encryptChallenge(
  key: CryptoKey,
  challenge: Uint8Array,
  aad: Uint8Array,
): Promise<Uint8Array> {
  if (challenge.length !== CHALLENGE_SIZE) {
    throw new Error("Challenge must be 32 bytes");
  }

  const nonce = crypto.getRandomValues(new Uint8Array(GCM_NONCE_SIZE));

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(nonce),
      additionalData: toArrayBuffer(aad),
      tagLength: GCM_TAG_SIZE * 8,
    },
    key,
    toArrayBuffer(challenge),
  );

  const encrypted = new Uint8Array(ciphertext);

  const result = new Uint8Array(nonce.length + encrypted.length);

  result.set(nonce, 0);
  result.set(encrypted, nonce.length);

  return result;
}

/**
 * AES-256-GCM decrypt with the handshake key.
 *
 * Input wire format:
 *
 *   nonce (12 bytes) || ciphertext || tag (16 bytes)
 *
 * `aad` is the packet's message type as an 8-byte big-endian uint64.
 * The plaintext is validated to be exactly 32 bytes (the challenge nonce).
 */
export async function decryptChallenge(
  key: CryptoKey,
  payload: Uint8Array,
  aad: Uint8Array,
): Promise<Uint8Array> {
  if (payload.length < GCM_NONCE_SIZE + GCM_TAG_SIZE) {
    throw new Error("Invalid challenge payload");
  }

  const nonce = payload.slice(0, GCM_NONCE_SIZE);

  const ciphertext = payload.slice(GCM_NONCE_SIZE);

  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(nonce),
      additionalData: toArrayBuffer(aad),
      tagLength: GCM_TAG_SIZE * 8,
    },
    key,
    toArrayBuffer(ciphertext),
  );

  const challenge = new Uint8Array(plaintext);

  if (challenge.length !== CHALLENGE_SIZE) {
    throw new Error("Invalid challenge length");
  }

  return challenge;
}

/**
 * Encrypt with a caller-provided CryptoKey and AAD.
 *
 * Same AES-GCM wire format as `encryptChallenge`:
 *   nonce (12) || ciphertext || tag (16)
 *
 * Used by the application-message path. Kept here so the entire AES-GCM
 * implementation lives in one file.
 */
export async function encryptWithKey(
  key: CryptoKey,
  plaintext: Uint8Array,
  aad: Uint8Array,
): Promise<Uint8Array> {
  const nonce = crypto.getRandomValues(new Uint8Array(GCM_NONCE_SIZE));

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(nonce),
      additionalData: toArrayBuffer(aad),
      tagLength: GCM_TAG_SIZE * 8,
    },
    key,
    toArrayBuffer(plaintext),
  );

  const encrypted = new Uint8Array(ciphertext);

  const result = new Uint8Array(nonce.length + encrypted.length);
  result.set(nonce, 0);
  result.set(encrypted, nonce.length);
  return result;
}

/**
 * Decrypt with a caller-provided CryptoKey and AAD.
 *
 * Input wire format:
 *   nonce (12) || ciphertext || tag (16)
 *
 * Used by the application-message path.
 */
export async function decryptWithKey(
  key: CryptoKey,
  payload: Uint8Array,
  aad: Uint8Array,
): Promise<Uint8Array> {
  if (payload.length < GCM_NONCE_SIZE + GCM_TAG_SIZE) {
    throw new Error("Invalid encrypted payload length");
  }

  const nonce = payload.slice(0, GCM_NONCE_SIZE);
  const ciphertext = payload.slice(GCM_NONCE_SIZE);

  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(nonce),
      additionalData: toArrayBuffer(aad),
      tagLength: GCM_TAG_SIZE * 8,
    },
    key,
    toArrayBuffer(ciphertext),
  );

  return new Uint8Array(plaintext);
}
