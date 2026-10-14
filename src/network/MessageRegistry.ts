// src/network/MessageRegistry.ts

/**
 * MessageRegistry — central, data-driven lookup from message type id to
 * MessageDefinition.
 *
 * Mirrors the Python reference in `message_registry.py` (the registry role,
 * not the codec that happens to live in the same Python file).
 *
 * The generic network layer (RemoteConnection) must resolve:
 *
 *     packet.messageType -> MessageRegistry.get(...) -> MessageDefinition
 *
 * and never contain message-specific branches.
 *
 * Registration is explicit and one-time. Duplicate ids are rejected.
 */

import type { MessageDefinition } from "./protocol";
import { ProtocolError } from "./protocol";

class MessageRegistryImpl {
  private readonly definitions = new Map<number, MessageDefinition<unknown>>();

  register<T>(definition: MessageDefinition<T>): void {
    if (this.definitions.has(definition.id)) {
      const existing = this.definitions.get(definition.id);
      throw new ProtocolError(
        `MessageRegistry: id ${definition.id} already registered ` +
          `(existing=${existing?.name}, new=${definition.name})`,
      );
    }
    this.definitions.set(
      definition.id,
      definition as MessageDefinition<unknown>,
    );
  }

  get(id: number): MessageDefinition<unknown> | undefined {
    return this.definitions.get(id);
  }

  has(id: number): boolean {
    return this.definitions.has(id);
  }

  list(): MessageDefinition<unknown>[] {
    return Array.from(this.definitions.values());
  }
}

export const MessageRegistry = new MessageRegistryImpl();
