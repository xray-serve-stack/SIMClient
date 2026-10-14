// src/network/messageDefinitions/index.ts

/**
 * One-time registration of all application message definitions.
 *
 * Importing this module registers every message exactly once. It is safe
 * to import from multiple places; ES module evaluation is cached.
 *
 * REGISTER (id 0) and AUTHENTICATE (id 1) are intentionally NOT
 * registered here. They are handshake messages handled directly by
 * RemoteConnection, which hardcodes their ids via ProtocolMessageTypes.ts.
 * The handshake path must not be routed through the registry.
 */

import { MessageRegistry } from "../MessageRegistry";
import { GET_SIMS } from "./GET_SIMS";
import { GET_CONVERSATIONS } from "./GET_CONVERSATIONS";
import { GET_MESSAGES } from "./GET_MESSAGES";
import { GET_MESSAGES_SUMMARY } from "./GET_MESSAGES_SUMMARY";
import { SEND_SMS } from "./SEND_SMS";
import { SYNC_STATUS } from "./SYNC_STATUS";
import { WATCH_PEERS } from "./WATCH_PEERS";
import { PEER_ONLINE } from "./PEER_ONLINE";
import { PEER_OFFLINE } from "./PEER_OFFLINE";

MessageRegistry.register(GET_SIMS);
MessageRegistry.register(GET_CONVERSATIONS);
MessageRegistry.register(GET_MESSAGES);
MessageRegistry.register(GET_MESSAGES_SUMMARY);
MessageRegistry.register(SEND_SMS);
MessageRegistry.register(SYNC_STATUS);
MessageRegistry.register(WATCH_PEERS);
MessageRegistry.register(PEER_ONLINE);
MessageRegistry.register(PEER_OFFLINE);

export { GET_SIMS } from "./GET_SIMS";
export { GET_CONVERSATIONS } from "./GET_CONVERSATIONS";
export { GET_MESSAGES } from "./GET_MESSAGES";
export { GET_MESSAGES_SUMMARY } from "./GET_MESSAGES_SUMMARY";
export { SEND_SMS } from "./SEND_SMS";
export { SYNC_STATUS } from "./SYNC_STATUS";
export { WATCH_PEERS } from "./WATCH_PEERS";
export { PEER_ONLINE } from "./PEER_ONLINE";
export { PEER_OFFLINE } from "./PEER_OFFLINE";
