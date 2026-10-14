// src/runtime/currentServe.ts

/**
 * CurrentServe — the single source of truth for "which Serve is the active
 * application context".
 *
 * Owns:
 *   - serveId    : the logical id used by the store, commands, and DB
 *   - publicKey  : the base64 X25519 public key used as packet destination
 *
 * Invariant:
 *   active Serve in UI = CurrentServe.serveId
 *   packet.peer        = CurrentServe.publicKey (as raw 32 bytes)
 *
 * All consumers read from this module. No consumer keeps an independent
 * copy. `RemoteConnection` in particular must NOT cache the public key.
 *
 * The module is deliberately synchronous. Setting the current Serve is a
 * cheap in-memory write; there is no async work that could race with the
 * next command. Shared-secret derivation is a separate, Serve-scoped
 * concern (see SharedSecretCache) and does not gate the current-Serve
 * write.
 *
 * Subscribers are notified synchronously on every change. The callback
 * receives the new state. Unsubscribe returns a function.
 */

export interface CurrentServeState {
  serveId: number | null;
  /** Base64 X25519 public key, or null when no Serve is selected. */
  publicKey: string | null;
}

type Listener = (state: CurrentServeState) => void;

class CurrentServeManager {
  private state: CurrentServeState = { serveId: null, publicKey: null };
  private listeners = new Set<Listener>();

  get(): CurrentServeState {
    return this.state;
  }

  getServeId(): number | null {
    return this.state.serveId;
  }

  getPublicKey(): string | null {
    return this.state.publicKey;
  }

  /**
   * Set both fields atomically. Passing `null` for `serveId` clears the
   * public key as well; the two are never updated independently.
   */
  set(serveId: number | null, publicKey: string | null): void {
    if (serveId === null) {
      if (this.state.serveId === null && this.state.publicKey === null) return;
      this.state = { serveId: null, publicKey: null };
      this.notify();
      return;
    }
    if (!publicKey) {
      throw new Error(
        `CurrentServe.set: publicKey is required when serveId=${serveId}`,
      );
    }
    if (this.state.serveId === serveId && this.state.publicKey === publicKey) {
      return;
    }
    this.state = { serveId, publicKey };
    this.notify();
  }

  clear(): void {
    this.set(null, null);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snapshot = this.state;
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (error) {
        console.error("[SIMServe][SERVE] CurrentServe listener failed:", error);
      }
    }
  }
}

export const CurrentServe = new CurrentServeManager();
