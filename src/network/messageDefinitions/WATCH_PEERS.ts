// src/network/messageDefinitions/WATCH_PEERS.ts

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

export class WatchPeersPayloadCodec implements PayloadCodec<Uint8Array[]> {
  parse(_peerRole: PeerRole, payload: Uint8Array): Uint8Array[] {
    // A zero-length payload is the valid encoding of "no peers are
    // online": an empty set of 32-byte keys. It is a multiple of 32.
    // Any other non-multiple-of-32 length is rejected.
    if (payload.length % PUBLIC_KEY_SIZE !== 0) {
      throw new InvalidPayload(
        "WATCH_PEERS payload length must be a multiple of 32",
      );
    }
    const out: Uint8Array[] = [];
    for (let i = 0; i < payload.length; i += PUBLIC_KEY_SIZE) {
      out.push(payload.slice(i, i + PUBLIC_KEY_SIZE));
    }
    return out;
  }

  serialize(_peerRole: PeerRole, payload: Uint8Array[]): Uint8Array {
    // The request must carry at least one key. A client with no Serves
    // to watch has nothing to ask and must not send the message.
    if (payload.length === 0) {
      throw new InvalidPayload(
        "WATCH_PEERS request must contain at least one public key",
      );
    }
    for (const key of payload) {
      if (key.length !== PUBLIC_KEY_SIZE) {
        throw new InvalidPayload(
          "WATCH_PEERS public keys must be exactly 32 bytes",
        );
      }
    }
    const total = payload.reduce((n, k) => n + k.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const key of payload) {
      out.set(key, offset);
      offset += key.length;
    }
    return out;
  }
}

export const WATCH_PEERS: MessageDefinition<Uint8Array[]> = {
  id: 2,
  name: "WATCH_PEERS",
  kind: MessageKind.PROTOCOL,
  category: MessageCategory.SYSTEM,
  protection: PayloadProtection.PLAINTEXT,
  codec: new WatchPeersPayloadCodec(),
  description: "Request online notifications for selected peers.",
};
