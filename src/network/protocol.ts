/**
 * Protocol primitives for the application-message layer.
 *
 * Mirrors the Python reference in `protocol.py`:
 *   - PayloadProtection
 *   - PeerRole
 *   - MessageKind
 *   - MessageCategory
 *   - ProtocolError / InvalidPayload
 *   - PayloadCodec<T>
 *   - MessageDefinition<T>
 *
 * This module is protocol-agnostic: it does not know about GET_SIMS or any
 * specific message. Concrete message definitions live under
 * `network/messageDefinitions/`.
 */

export enum PayloadProtection {
  PLAINTEXT = "PLAINTEXT",
  ENCRYPTED = "ENCRYPTED",
}

export enum PeerRole {
  SERVER = "SERVER",
  CLIENT = "CLIENT",
  SERVE = "SERVE",
}

export enum MessageKind {
  COMMAND = "COMMAND",
  EVENT = "EVENT",
  PROTOCOL = "PROTOCOL",
}

export enum MessageCategory {
  SYSTEM = "SYSTEM",
  SMS = "SMS",
  SIM = "SIM",
  CONVERSATION = "CONVERSATION",
}

export class ProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProtocolError";
  }
}

export class InvalidPayload extends ProtocolError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPayload";
  }
}

/**
 * A PayloadCodec is responsible for converting between wire bytes and a
 * typed, validated payload value. Direction is represented by the method
 * called (`parse` for inbound, `serialize` for outbound), NOT by the
 * PeerRole argument.
 *
 * `peer_role` is the LOCAL endpoint's role, not the remote peer's role.
 * For the Client, it is always `PeerRole.CLIENT`.
 */
export interface PayloadCodec<T> {
  parse(peerRole: PeerRole, payload: Uint8Array): T;
  serialize(peerRole: PeerRole, payload: T): Uint8Array;
}

export interface MessageDefinition<T> {
  readonly id: number;
  readonly name: string;
  readonly kind: MessageKind;
  readonly category: MessageCategory;
  readonly protection: PayloadProtection;
  readonly codec: PayloadCodec<T>;
  readonly description: string;
}
