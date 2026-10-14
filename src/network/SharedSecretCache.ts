// src/network/SharedSecretCache.ts

/**
 * SharedSecretCache — per-Serve X25519 + HKDF + AES-GCM key cache.
 *
 * Mirrors the Serve-side "cached shared secret" model:
 *
 *     servePublicKey (base64) -> CryptoKey
 *
 * Populated once at startup from the stored `Serves` table, and refreshed
 * whenever the Serve list changes (create / rename / delete).
 *
 * The cache does NOT decide authorization. It only answers:
 * "given this peer public key, what is the AES key?".
 *
 * Derivation reuses `derivePeerKey` from `Crypto.ts`, which is the same
 * X25519 + HKDF-SHA256 (salt="", info="SIMServe-v1", 32-byte AES-256-GCM)
 * used by the authentication handshake. There is no second crypto scheme.
 *
 * Key identity: the cache is keyed by the base64 string of the Serve's
 * X25519 public key, which is exactly the form stored in `Serve.public_key`.
 */

import { base64ToBytes, bytesToBase64 } from "../cache/clientIdentity";
import { derivePeerKey } from "./Crypto";

interface CacheEntry {
  key: CryptoKey;
  bytes: Uint8Array;
}

class SharedSecretCacheImpl {
  private entries = new Map<string, CacheEntry>();

  /**
   * Ensure a shared-secret key exists for the given Serve public key.
   * `clientPrivateKey` is the Client's own X25519 private key.
   *
   * Idempotent. If the entry already exists it is returned untouched.
   */
  async ensure(
    servePublicKeyB64: string,
    clientPrivateKey: Uint8Array,
  ): Promise<void> {
    if (this.entries.has(servePublicKeyB64)) return;

    const serverPublicKey = base64ToBytes(servePublicKeyB64);
    if (serverPublicKey.length !== 32) {
      throw new Error(
        `SharedSecretCache: Serve public key must be 32 bytes, got ${serverPublicKey.length}`,
      );
    }

    const key = await derivePeerKey(clientPrivateKey, serverPublicKey);
    this.entries.set(servePublicKeyB64, {
      key,
      bytes: serverPublicKey,
    });
  }

  /**
   * Look up the cached AES key for a peer public key.
   *
   * Accepts either the base64 form (what `Serve.public_key` stores) or the
   * raw 32-byte public key (what `packet.peer` contains).
   *
   * Returns `undefined` if the peer is not cached.
   */
  get(peerPublicKey: Uint8Array | string): CryptoKey | undefined {
    const key =
      typeof peerPublicKey === "string"
        ? peerPublicKey
        : bytesToBase64(peerPublicKey);
    return this.entries.get(key)?.key;
  }

  has(peerPublicKey: Uint8Array | string): boolean {
    const key =
      typeof peerPublicKey === "string"
        ? peerPublicKey
        : bytesToBase64(peerPublicKey);
    return this.entries.has(key);
  }

  /**
   * Drop entries for Serves that are no longer present. Called after the
   * Serve list changes so the cache does not grow unbounded and does not
   * hold keys for deleted Serves.
   */
  retainOnly(servePublicKeysB64: Iterable<string>): void {
    const keep = new Set(servePublicKeysB64);
    for (const key of this.entries.keys()) {
      if (!keep.has(key)) this.entries.delete(key);
    }
  }

  clear(): void {
    this.entries.clear();
  }
}

export const SharedSecretCache = new SharedSecretCacheImpl();
