/**
 * Protocol message type IDs.
 *
 * These mirror the `id` values of the Python Server's `MessageDefinition`
 * entries. They are the 8-byte big-endian `message_type` field in the
 * packet header — NOT one-byte values.
 *
 *   REGISTER      (id = 0)  Client -> Server: [ZERO][REGISTER][client_pubkey]
 *   AUTHENTICATE  (id = 1)  Server -> Client: [server_pubkey][AUTHENTICATE][encrypted_nonce]
 *                           Client -> Server: [ZERO][AUTHENTICATE][plaintext_nonce]
 *
 * There is no separate AUTH_RESPONSE message. The Client's response is an
 * AUTHENTICATE packet with id 1, containing the decrypted nonce in plaintext.
 *
 * Application message ids (e.g. GET_SIMS = 11) are NOT listed here. They are
 * owned by their respective `MessageDefinition` modules under
 * `network/messageDefinitions/`. This file is only for the handshake ids
 * used directly by `RemoteConnection`.
 */
export const REGISTER = 0;
export const AUTHENTICATE = 1;
