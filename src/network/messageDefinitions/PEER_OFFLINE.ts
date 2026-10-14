// src/network/messageDefinitions/PEER_OFFLINE.ts

import {
  InvalidPayload,
  MessageCategory,
  MessageDefinition,
  MessageKind,
  PayloadCodec,
  PayloadProtection,
  PeerRole,
} from "../protocol";

const PUBLIC_KEY_SIZE = 32;

export class PeerOfflinePayloadCodec implements PayloadCodec<Uint8Array> {
  parse(peerRole: PeerRole, payload: Uint8Array): Uint8Array {
    if (peerRole !== PeerRole.CLIENT) {
      throw new InvalidPayload("PEER_OFFLINE can only be received by CLIENT");
    }
    if (payload.length !== PUBLIC_KEY_SIZE) {
      throw new InvalidPayload("PEER_OFFLINE payload must be exactly 32 bytes");
    }
    return payload;
  }

  serialize(peerRole: PeerRole, payload: Uint8Array): Uint8Array {
    if (peerRole !== PeerRole.SERVE) {
      throw new InvalidPayload("PEER_OFFLINE can only be sent by SERVE");
    }
    if (payload.length !== PUBLIC_KEY_SIZE) {
      throw new InvalidPayload("PEER_OFFLINE payload must be exactly 32 bytes");
    }
    return payload;
  }
}

export const PEER_OFFLINE: MessageDefinition<Uint8Array> = {
  id: 4,
  name: "PEER_OFFLINE",
  kind: MessageKind.EVENT,
  category: MessageCategory.SYSTEM,
  protection: PayloadProtection.PLAINTEXT,
  codec: new PeerOfflinePayloadCodec(),
  description: "Notify a peer that another peer is offline.",
};
