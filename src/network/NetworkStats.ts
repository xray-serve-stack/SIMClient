// src/network/NetworkStats.ts

/**
 * NetworkStats — passive counters for bytes and packets on the WebSocket.
 *
 * Recorded at two points:
 *   - `recordSend` immediately before every `webSocket.send(...)` in
 *     RemoteConnection. The bytes recorded are exactly the bytes handed to
 *     the socket (the `Uint8Array` returned by `encodePacket`, or whatever
 *     the caller passed to `send`).
 *   - `recordReceive` at the very top of `webSocket.onmessage`, before
 *     `decodePacket`, so we count what the network delivered, not what
 *     survived decoding.
 *
 * Counts are session-only. They reset on page reload. No persistence, no
 * timers, no polling. Subscribers are notified synchronously on each
 * update; React 18 batches the resulting renders.
 *
 * Byte counts are WebSocket payload bytes only, not frame overhead. Frame
 * overhead is chosen by the browser's network stack and is not observable
 * from JavaScript.
 */

export interface NetworkStatsSnapshot {
  sendCount: number;
  sendBytes: number;
  receiveCount: number;
  receiveBytes: number;
}

type Listener = (snapshot: NetworkStatsSnapshot) => void;

class NetworkStatsImpl {
  private sendCount = 0;
  private sendBytes = 0;
  private receiveCount = 0;
  private receiveBytes = 0;

  private readonly listeners = new Set<Listener>();

  /**
   * Record one outbound packet. `bytes` is the exact Uint8Array handed to
   * `WebSocket.send`.
   */
  recordSend(bytes: Uint8Array): void {
    this.sendCount += 1;
    this.sendBytes += bytes.byteLength;
    this.notify();
  }

  /**
   * Record one inbound frame. `bytes` is the exact Uint8Array received in
   * `WebSocket.onmessage`, before any parsing.
   */
  recordReceive(bytes: Uint8Array): void {
    this.receiveCount += 1;
    this.receiveBytes += bytes.byteLength;
    this.notify();
  }

  /**
   * Snapshot of the current counters. Returned by value; the caller owns
   * the object and cannot mutate internal state through it.
   */
  getStats(): NetworkStatsSnapshot {
    return {
      sendCount: this.sendCount,
      sendBytes: this.sendBytes,
      receiveCount: this.receiveCount,
      receiveBytes: this.receiveBytes,
    };
  }

  /**
   * Reset all counters. Not called today; provided so a future "clear
   * stats" affordance does not need to reach into module internals.
   */
  reset(): void {
    this.sendCount = 0;
    this.sendBytes = 0;
    this.receiveCount = 0;
    this.receiveBytes = 0;
    this.notify();
  }

  /**
   * Subscribe to counter updates. The listener is invoked synchronously
   * after every `recordSend` / `recordReceive` / `reset`. Returns an
   * unsubscribe function.
   *
   * React components using `useSyncExternalStore` will be notified on each
   * event; React batches the re-renders automatically, so a burst of
   * packets does not cause a burst of renders.
   */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snapshot = this.getStats();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (error) {
        console.error("[NetworkStats] listener failed:", error);
      }
    }
  }
}

export const NetworkStats = new NetworkStatsImpl();
