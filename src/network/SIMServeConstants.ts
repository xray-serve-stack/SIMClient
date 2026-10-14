// src/network/SIMServeConstants.ts

/**
 * Hex-encoded AES-256 key used to decrypt the remote config payload.
 *
 * This is NOT a CA certificate. It is the 32-byte AES-256-GCM key,
 * represented as 64 lowercase hex characters. It is decoded directly with
 * `hexToBytes()` and passed to `crypto.subtle.importKey("raw", ...)` as the
 * AES key. No SHA-256 step is applied.
 *
 * The on-disk encrypted config format is unchanged:
 *   [ 12-byte IV ][ ciphertext + 16-byte GCM tag ]
 */

export const SIMSERVE_CA_CERT_HEX =
  "2d0bf9957e2bbd689d8c5f98b6a8537b4c23f4367ad060d29fca71de42a5a1ca";

export const REMOTE_CONFIG_URL =
  "https://raw.githubusercontent.com/xray-serve-stack/SIMServer/main/.dev/tools/simserve_config.b64";

export const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

export const MAX_BACKOFF_SECONDS = 300;

export const HEALTHY_SURVIVAL_MS = 60 * 1000;
