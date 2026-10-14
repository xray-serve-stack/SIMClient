import { REMOTE_CONFIG_URL, SIMSERVE_CA_CERT_HEX } from "./SIMServeConstants";
import { configManager } from "./ConfigManager";
import type { SIMServeConfig } from "./SIMServeConfig";
import { saveConfig } from "./ConfigLoader";

/**
 * Decode a hex string into a Uint8Array.
 *
 * Throws on odd length or non-hex characters.
 */
function hexToBytes(hex: string): Uint8Array {
  const trimmed = hex.trim();

  if (trimmed.length % 2 !== 0) {
    throw new Error(`hexToBytes: odd-length hex string (${trimmed.length})`);
  }

  if (!/^[0-9a-fA-F]*$/.test(trimmed)) {
    throw new Error("hexToBytes: input contains non-hex characters");
  }

  const out = new Uint8Array(trimmed.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(trimmed.substring(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * Narrow a Uint8Array's underlying buffer to ArrayBuffer for Web Crypto.
 *
 * TypeScript 5.7+ types Uint8Array's `.buffer` as ArrayBufferLike, which may
 * include SharedArrayBuffer. Web Crypto's BufferSource requires ArrayBuffer.
 * A slice produces a fresh, non-shared ArrayBuffer.
 */
function toBufferSource(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer;
}

/**
 * Decode a base64 string into a Uint8Array without any UTF-8 conversion.
 *
 * Uses atob(), which returns a binary string whose char codes are exactly
 * the decoded byte values. The result is a copy in a fresh Uint8Array, so
 * the caller owns independent memory.
 *
 * Throws on invalid base64 input; the caller is expected to catch and
 * report a decode failure.
 */
function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export class ConfigRefresher {
  async refresh(): Promise<boolean> {
    configManager.markRefreshAttempt();

    try {
      const encrypted = await this.downloadEncryptedConfig();

      if (encrypted === null) {
        return false;
      }

      const plaintext = await this.decrypt(encrypted);

      if (plaintext === null) {
        return false;
      }

      const newConfig = this.parseAndValidate(plaintext);

      if (newConfig === null) {
        return false;
      }

      try {
        await saveConfig(newConfig);
      } catch (error) {
        console.warn(
          "ConfigRefresher: failed to persist refreshed config to meta",
          error,
        );
      }

      configManager.update(newConfig);

      return true;
    } catch {
      return false;
    }
  }

  private async downloadEncryptedConfig(): Promise<ArrayBuffer | null> {
    let response: Response;

    try {
      response = await fetch(REMOTE_CONFIG_URL);
    } catch (error) {
      console.warn("[Config] fetch failed:", error);
      return null;
    }

    if (!response.ok) {
      console.warn(
        `[Config] GitHub response not ok: status=${response.status}`,
      );
      return null;
    }

    let innerBase64: string;

    try {
      innerBase64 = await response.text();
    } catch (error) {
      console.warn("[Config] failed to read GitHub response:", error);
      return null;
    }

    // Base64 decode: text of simserve_config.b64 -> encrypted binary
    const normalizedBase64 = innerBase64.replace(/\s+/g, "");

    let encryptedBytes: Uint8Array;

    try {
      encryptedBytes = base64ToBytes(normalizedBase64);
    } catch (error) {
      console.warn("[Config] Base64 decode failed:", error);
      return null;
    }

    return toBufferSource(encryptedBytes);
  }

  private async decrypt(encrypted: ArrayBuffer): Promise<ArrayBuffer | null> {
    const encryptedBytes = new Uint8Array(encrypted);

    const IV_LENGTH = 12;
    const GCM_TAG_LENGTH_BYTES = 16;
    const AES_KEY_LENGTH = 32;
    const TAG_LENGTH_BITS = 128;

    if (encryptedBytes.length < IV_LENGTH + GCM_TAG_LENGTH_BYTES) {
      console.warn("[Config] encrypted payload too short");
      return null;
    }

    const iv = encryptedBytes.slice(0, IV_LENGTH);
    const ciphertext = encryptedBytes.slice(IV_LENGTH);

    let aesKeyBytes: Uint8Array;
    try {
      aesKeyBytes = hexToBytes(SIMSERVE_CA_CERT_HEX);
    } catch (error) {
      console.warn("[Config] failed to decode AES key hex:", error);
      return null;
    }

    if (aesKeyBytes.length !== AES_KEY_LENGTH) {
      console.warn("[Config] AES key length is invalid");
      return null;
    }

    let key: CryptoKey;
    try {
      key = await crypto.subtle.importKey(
        "raw",
        toBufferSource(aesKeyBytes),
        {
          name: "AES-GCM",
        },
        false,
        ["decrypt"],
      );
    } catch (error) {
      console.warn("[Config] AES key import failed:", error);
      return null;
    }

    let plaintext: ArrayBuffer;
    try {
      plaintext = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: toBufferSource(iv),
          tagLength: TAG_LENGTH_BITS,
        },
        key,
        toBufferSource(ciphertext),
      );
    } catch (error) {
      console.warn("[Config] AES-GCM decrypt failed:", error);
      return null;
    }

    return plaintext;
  }

  private parseAndValidate(plaintext: ArrayBuffer): SIMServeConfig | null {
    let decoded: string;
    let root: unknown;

    try {
      decoded = new TextDecoder().decode(plaintext);
    } catch (error) {
      console.warn("[Config] failed to decode config plaintext:", error);
      return null;
    }

    try {
      root = JSON.parse(decoded);
    } catch (error) {
      console.warn("[Config] failed to parse config JSON:", error);
      return null;
    }

    if (typeof root !== "object" || root === null) {
      console.warn("[Config] config root is not an object");
      return null;
    }

    const server = (root as Record<string, unknown>)["server"];

    if (typeof server !== "object" || server === null) {
      console.warn("[Config] config.server is missing or not an object");
      return null;
    }

    const host = (server as Record<string, unknown>)["host"];
    const port = (server as Record<string, unknown>)["port"];

    if (typeof host !== "string" || host.trim() === "") {
      console.warn("[Config] config.server.host is invalid");
      return null;
    }

    if (
      typeof port !== "number" ||
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65535
    ) {
      console.warn("[Config] config.server.port is invalid");
      return null;
    }

    return {
      host,
      port,
    };
  }
}
