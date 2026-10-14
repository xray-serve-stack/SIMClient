// src/runtime/activeServeProvider.ts

/**
 * Providers for runtime state that the network layer must read without
 * importing the chat store directly.
 *
 * Two providers are registered once at startup by `main.tsx`:
 *
 *   - active serve id  — used by ApplicationDispatcher when mapping an
 *     inbound SIMS_RESULT to its owning serveId.
 *   - active chat      — used by ApplicationDispatcher to resolve the
 *     conversation `number` for an inbound GET_MESSAGES response, which
 *     does not carry the number on the wire.
 *
 * Registering providers instead of importing the store avoids a
 * module-init cycle:
 *
 *   chatStore -> runtime/commandQueue -> runtime/commands
 *   runtime/resultHandlers -> chatStore
 *   network/RemoteConnection -> ApplicationDispatcher
 *
 * Both providers are trivial function references. They have no state of
 * their own and no behavior beyond forwarding.
 */

let serveProvider: (() => number | null) | null = null;
let chatProvider: (() => string | null) | null = null;

export function setActiveServeIdProvider(fn: () => number | null): void {
  serveProvider = fn;
}

export function getActiveServeId(): number | null {
  if (serveProvider === null) {
    console.warn(
      "[SIMServe][APP] active serve id provider is not registered yet",
    );
    return null;
  }
  return serveProvider();
}

export function setActiveChatProvider(fn: () => string | null): void {
  chatProvider = fn;
}

export function getActiveChat(): string | null {
  if (chatProvider === null) {
    console.warn("[SIMServe][APP] active chat provider is not registered yet");
    return null;
  }
  return chatProvider();
}
