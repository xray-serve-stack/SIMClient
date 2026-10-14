import { getMeta, setMeta } from "@/cache/chatRepository";
import { configManager } from "./ConfigManager";
import type { SIMServeConfig } from "./SIMServeConfig";

/**
 * Client-side loader for the SIMServe server configuration.
 *
 * On the Android Serve this is read from `simserve_config.json`. The Client
 * deliberately does NOT use a JSON file: configuration comes from the
 * IndexedDB-backed `meta` key/value store, populated by whatever onboarding
 * or configuration UI eventually writes it.
 *
 * Semantics:
 *   - SERVER_HOST and SERVER_PORT are read from `meta`.
 *   - If either value is missing, malformed, or the DB read throws, the
 *     deliberate fallback `192.0.2.1:1` is used. This is not a silent
 *     success: `configManager.getUrl()` will produce a URL pointing at
 *     TEST-NET-1, RemoteConnection will attempt to open a WebSocket to it,
 *     the attempt will fail, and the existing retry/backoff loop in
 *     RemoteConnection will take over.
 *   - The loader must never throw. It must always return a valid
 *     SIMServeConfig, because configManager.load() must always be called
 *     before any code path can invoke RemoteConnection.connect().
 */

const META_KEY_HOST = "SERVER_HOST";
const META_KEY_PORT = "SERVER_PORT";

/**
 * Deliberate fallback, matching the Android ConfigLoader.
 *
 * 192.0.2.1 is TEST-NET-1 (RFC 5737) — reserved, non-routable, guaranteed to
 * fail. Port 1 is a reserved privileged port. Both values are chosen so that
 * the WebSocket handshake fails immediately and RemoteConnection's retry
 * logic engages naturally. Do not replace these with "sensible defaults" —
 * they are load-bearing.
 */
export const FALLBACK_CONFIG: SIMServeConfig = {
  host: "192.0.2.1",
  port: 1,
};

function isValidHost(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidPort(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 65535
  );
}

/**
 * The meta store preserves the JS type of whatever was written. Today there
 * is no writer for SERVER_PORT, so we accept either number or numeric string
 * to be resilient to whatever the future configuration UI chooses to store.
 */
function coercePort(raw: unknown): number | undefined {
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.length === 0) return undefined;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/**
 * Load the SIMServe server configuration from `meta`.
 *
 * Never throws. Always returns a SIMServeConfig — either the stored values
 * (if valid) or FALLBACK_CONFIG.
 */
export async function loadConfig(): Promise<SIMServeConfig> {
  try {
    const [rawHost, rawPort] = await Promise.all([
      getMeta<string>(META_KEY_HOST),
      getMeta<unknown>(META_KEY_PORT),
    ]);

    const port = coercePort(rawPort);

    if (!isValidHost(rawHost) || !isValidPort(port)) {
      return FALLBACK_CONFIG;
    }

    return {
      host: rawHost.trim(),
      port,
    };
  } catch (error) {
    console.error(
      "[ConfigLoader] failed to read server config from meta:",
      error,
    );
    return FALLBACK_CONFIG;
  }
}

/**
 * Load the config from `meta` and hand it to the shared configManager.
 *
 * This is the ONE place configManager.load(...) is called during startup.
 * It must run before any code that calls RemoteConnection.connect(), because
 * configManager.getUrl() throws if the config is not loaded.
 *
 * Returns the config that was loaded, so callers can log or inspect it.
 */
export async function loadAndApplyConfig(): Promise<SIMServeConfig> {
  const config = await loadConfig();
  configManager.load(config);
  return config;
}

/**
 * Persist a config into the `meta` store.
 *
 * Not currently called by anything. Provided so a future configuration UI has
 * a canonical writer and does not manipulate the meta store directly. If you
 * prefer to keep writes out of this file until the UI exists, delete this
 * function — nothing depends on it.
 */
export async function saveConfig(config: SIMServeConfig): Promise<void> {
  await setMeta<string>(META_KEY_HOST, config.host);
  await setMeta<number>(META_KEY_PORT, config.port);
}
