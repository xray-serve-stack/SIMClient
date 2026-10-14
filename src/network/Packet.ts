export const PUBLIC_KEY_SIZE = 32;
export const TYPE_SIZE = 8;
export const HEADER_SIZE = PUBLIC_KEY_SIZE + TYPE_SIZE;

export interface Packet {
  peer: Uint8Array;
  messageType: bigint;
  payload: Uint8Array;
}

export function encodePacket(packet: Packet): Uint8Array {
  if (packet.peer.length !== PUBLIC_KEY_SIZE) {
    throw new Error("Peer public key must be 32 bytes");
  }

  if (packet.messageType < 0n || packet.messageType > 0xffffffffffffffffn) {
    throw new Error("Message type must fit uint64");
  }

  const result = new Uint8Array(HEADER_SIZE + packet.payload.length);

  result.set(packet.peer, 0);

  const view = new DataView(
    result.buffer,
    result.byteOffset,
    result.byteLength,
  );

  view.setBigUint64(PUBLIC_KEY_SIZE, packet.messageType, false);

  result.set(packet.payload, HEADER_SIZE);

  return result;
}

export function decodePacket(data: Uint8Array): Packet {
  if (data.length < HEADER_SIZE) {
    throw new Error("Packet too short");
  }

  const peer = data.slice(0, PUBLIC_KEY_SIZE);

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  const messageType = view.getBigUint64(PUBLIC_KEY_SIZE, false);

  const payload = data.slice(HEADER_SIZE);

  return {
    peer,
    messageType,
    payload,
  };
}
