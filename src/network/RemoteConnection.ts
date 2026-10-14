// src/network/RemoteConnection.ts

import { CurrentServe } from "@/runtime/currentServe";
import { configManager } from "./ConfigManager";
import { ConfigRefresher } from "./ConfigRefresher";
import { ConnectionState } from "./ConnectionState";
import { HEALTHY_SURVIVAL_MS, MAX_BACKOFF_SECONDS } from "./SIMServeConstants";
import {
  RESERVED_KEY,
  derivePeerKey,
  decryptChallenge,
  CHALLENGE_SIZE,
} from "./Crypto";
import {
  getOrCreateClientIdentity,
  base64ToBytes,
  bytesToBase64,
} from "../cache/clientIdentity";
import { REGISTER, AUTHENTICATE } from "./ProtocolMessageTypes";
import { Packet, decodePacket, encodePacket } from "./Packet";
import { NetworkStats } from "./NetworkStats";

import { MessageRegistry } from "./MessageRegistry";
import { PayloadPipeline } from "./PayloadPipeline";
import { PeerRole, PayloadProtection } from "./protocol";
import { isAllowedServerEvent } from "./ServerEvents";
import { SharedSecretCache } from "./SharedSecretCache";
import { makeEncrypt, makeDecrypt } from "./ApplicationCrypto";
import {
  dispatchApplicationPayload,
  dispatchServerEventPayload,
} from "./ApplicationDispatcher";

import "./messageDefinitions"; // side-effect: register all message definitions

const HANDSHAKE_TIMEOUT_MS = 10_000;

export interface RemoteConnectionCallbacks {
  onMessage?: (message: string) => void;
  onStateChanged?: (state: ConnectionState) => void;
  onRegistered?: (serveId: string) => void;
}

/** The single local role for this endpoint. Never changes. */
const LOCAL_ROLE = PeerRole.CLIENT;

/** One pipeline for the lifetime of the connection. */
const pipeline = new PayloadPipeline(LOCAL_ROLE);

/**
 * One entry in the outgoing queue.
 *
 * `bytes` is the exact Uint8Array that will be handed to
 * `webSocket.send`.
 *
 * `destinationServePublicKey` is the base64 X25519 public key of the
 * Serve the packet is addressed to, or `null` for non-Serve packets:
 * handshake packets (REGISTER, AUTHENTICATE) and system packets
 * addressed to the reserved ZERO peer (e.g. WATCH_PEERS).
 *
 * The tag determines two things:
 *
 *   - the usability test in `isUsableFor`:
 *       null      -> socket must be OPEN
 *       non-null  -> socket must be OPEN AND state === CONNECTED
 *   - the destination validation in `drainQueue`:
 *       null      -> never validated
 *       non-null  -> dropped if not equal to CurrentServe.getPublicKey()
 */
interface QueuedPacket {
  bytes: Uint8Array;
  destinationServePublicKey: string | null;
}

export class RemoteConnection {
  private webSocket: WebSocket | null = null;

  private state = ConnectionState.DISCONNECTED;

  private shouldReconnect = true;

  private reconnectDelaySeconds = 1;

  private connectedAt = 0;

  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private handshakeTimer: ReturnType<typeof setTimeout> | null = null;

  private clientPublicKey: Uint8Array | null = null;
  private clientPrivateKey: Uint8Array | null = null;

  /**
   * Fired once per successful authentication, after the state transitions
   * to CONNECTED. Used by the runtime to (re)issue WATCH_PEERS. The
   * connection itself does not know what WATCH_PEERS is.
   */
  private onAuthenticated: (() => void) | null = null;

  /**
   * FIFO outgoing queue. Survives for the current web session. Not
   * persisted. Only `send()` enqueues, drains, or discards entries.
   */
  private readonly outgoingQueue: QueuedPacket[] = [];

  constructor(private readonly callbacks: RemoteConnectionCallbacks = {}) {}

  /**
   * Register the callback fired after every successful authentication.
   * Overwrites any previously registered callback.
   */
  setOnAuthenticated(fn: () => void): void {
    this.onAuthenticated = fn;
  }

  async init(): Promise<void> {
    const identity = await getOrCreateClientIdentity();

    const privateKey = base64ToBytes(identity.privateKeyB64);
    const publicKey = base64ToBytes(identity.publicKeyB64);

    if (privateKey.length !== 32) {
      throw new Error("Client private key must be 32 bytes");
    }
    if (publicKey.length !== 32) {
      throw new Error("Client public key must be 32 bytes");
    }

    this.clientPrivateKey = privateKey;
    this.clientPublicKey = publicKey;
  }

  connect(): void {
    if (!this.shouldReconnect) return;
    if (this.state !== ConnectionState.DISCONNECTED) return;

    const url = configManager.getUrl();

    console.info(`[SIMServe][WS] opening WS to ${url}`);

    this.setState(ConnectionState.CONNECTING);

    const webSocket = new WebSocket(url);
    webSocket.binaryType = "arraybuffer";
    this.webSocket = webSocket;

    webSocket.onopen = () => {
      if (this.webSocket !== webSocket) return;
      console.info("[SIMServe][WS] connected");
      void this.startHandshake(webSocket);
    };

    webSocket.onmessage = (event) => {
      if (this.webSocket !== webSocket) return;
      if (!(event.data instanceof ArrayBuffer)) {
        console.warn("[SIMServe][WS] ignoring non-binary message");
        return;
      }
      const bytes = new Uint8Array(event.data);
      // Count the raw frame as received, before any parsing.
      NetworkStats.recordReceive(bytes);
      void this.handleBinaryMessage(webSocket, bytes);
    };

    webSocket.onclose = () => {
      if (this.webSocket !== webSocket) return;
      this.handleConnectionLost(webSocket);
    };

    webSocket.onerror = () => {
      if (this.webSocket !== webSocket) return;
      console.warn("[SIMServe][WS] error");
    };
  }

  /**
   * Send an application packet to the current Serve.
   *
   * Convenience wrapper: resolves the current Serve's public key and
   * delegates to `sendApplicationWithPeer`.
   */
  async sendApplication<T>(payload: T, messageType: number): Promise<boolean> {
    const current = CurrentServe.get();
    if (current.serveId === null || current.publicKey === null) {
      console.warn("[SIMServe][APP] cannot send: no current Serve");
      return false;
    }

    return this.sendApplicationWithPeer(
      payload,
      messageType,
      base64ToBytes(current.publicKey),
    );
  }

  /**
   * Send an application packet to an explicit peer.
   *
   * Used both by `sendApplication` (peer = current Serve) and by
   * WATCH_PEERS (peer = RESERVED_KEY).
   *
   * Key lookup and the encrypt callable are only resolved for ENCRYPTED
   * messages. PLAINTEXT messages (WATCH_PEERS and the ZERO-peer family)
   * are serialized and transmitted without a shared secret.
   *
   * The queue tag passed to `send` is `null` when the peer is
   * RESERVED_KEY (ZERO) and the base64 form of the peer otherwise. The
   * ZERO peer is not a Serve and must not be validated against the
   * current Serve; `null` marks it as a system packet.
   */
  async sendApplicationWithPeer<T>(
    payload: T,
    messageType: number,
    peer: Uint8Array,
  ): Promise<boolean> {
    const definition = MessageRegistry.get(messageType);
    if (!definition) {
      console.warn(
        `[SIMServe][APP] cannot send: message type ${messageType} not registered`,
      );
      return false;
    }

    let encrypt = null;
    if (definition.protection === PayloadProtection.ENCRYPTED) {
      const key = SharedSecretCache.get(peer);
      if (!key) {
        console.warn(
          `[SIMServe][APP] cannot send: no cached shared secret for peer (type ${messageType})`,
        );
        return false;
      }
      encrypt = makeEncrypt(key);
    }

    try {
      const payloadBytes = await pipeline.send(definition, payload, encrypt);

      const packet: Packet = {
        peer,
        messageType: BigInt(definition.id),
        payload: payloadBytes,
      };

      const encoded = encodePacket(packet);

      const isZeroPeer = peer.every((b) => b === 0);
      const destinationTag = isZeroPeer ? null : bytesToBase64(peer);

      console.info(
        `[SIMServe][APP] send ${definition.name} type=${definition.id} destination=${bytesToBase64(peer)}`,
      );

      return this.send(encoded, destinationTag);
    } catch (error) {
      console.warn(`[SIMServe][APP] failed to send ${definition.name}:`, error);
      return false;
    }
  }

  /**
   * Send a packet, or enqueue it if the connection is not yet usable for
   * its class.
   *
   * This is the ONLY method that calls `webSocket.send`.
   *
   * Two packet classes, distinguished by `destinationServePublicKey`:
   *
   *   - null: handshake / system packet. Usable iff the socket is OPEN.
   *   - non-null: application packet. Usable iff the socket is OPEN AND
   *     `state === CONNECTED`.
   *
   * Returns `true` only if `message` itself was handed to the socket
   * during this call.
   */
  send(
    message: string | Uint8Array,
    destinationServePublicKey: string | null = null,
  ): boolean {
    const entry: QueuedPacket = {
      bytes:
        message instanceof Uint8Array
          ? message
          : new TextEncoder().encode(message),
      destinationServePublicKey,
    };

    if (!this.isUsableFor(entry)) {
      this.outgoingQueue.push(entry);
      return false;
    }

    this.drainQueue();

    if (!this.isUsableFor(entry)) {
      this.outgoingQueue.push(entry);
      return false;
    }

    this.transmit(entry);
    return true;
  }

  disconnect(): void {
    console.info("[SIMServe][WS] user-initiated disconnect");

    this.shouldReconnect = false;
    this.clearReconnectTimer();
    this.clearHandshakeTimer();

    const webSocket = this.webSocket;
    this.webSocket = null;

    if (webSocket !== null) {
      webSocket.close(1000, "client disconnect");
    }

    this.connectedAt = 0;
    // Do NOT null clientPrivateKey / clientPublicKey here.
    // Do NOT clear SharedSecretCache here.
    // Do NOT clear outgoingQueue here.

    this.setState(ConnectionState.DISCONNECTED);
  }

  // -------------------------------------------------------------------------
  // Queue internals
  // -------------------------------------------------------------------------

  /**
   * Whether the socket can accept a packet of the given class right now.
   *
   *   - null destination (handshake / system): socket exists and is OPEN.
   *   - non-null destination (application): socket exists and is OPEN,
   *     AND state === CONNECTED.
   */
  private isUsableFor(entry: QueuedPacket): boolean {
    if (this.webSocket === null) return false;
    if (this.webSocket.readyState !== WebSocket.OPEN) return false;
    if (entry.destinationServePublicKey === null) return true;
    return this.state === ConnectionState.CONNECTED;
  }

  /**
   * Transmit one packet and record its statistics.
   *
   * Precondition: the caller has verified that the packet's class is
   * usable. This method does not re-check.
   *
   * Copies the byte view into a fresh ArrayBuffer-backed Uint8Array so
   * the value satisfies `WebSocket.send`'s `BufferSource` parameter under
   * TypeScript 5.7+, where `Uint8Array` is generic over `ArrayBufferLike`.
   */
  private transmit(entry: QueuedPacket): void {
    if (this.webSocket === null) return;

    const bytes = entry.bytes;
    if (bytes instanceof Uint8Array) {
      NetworkStats.recordSend(bytes);
    }

    const out = new Uint8Array(bytes.byteLength);
    out.set(bytes);
    this.webSocket.send(out);
  }

  /**
   * Process the outgoing queue in FIFO order, one packet at a time.
   *
   * Before each packet:
   *   - the socket is re-checked via `isUsableFor`. If not usable, the
   *     loop stops and every remaining packet (including the current
   *     head) stays queued.
   *   - the destination Serve is validated for application packets. A
   *     Serve-addressed packet whose Serve is no longer current is
   *     discarded. Handshake and system packets are never validated.
   *
   * A packet is removed from the queue only after `transmit` returns.
   */
  private drainQueue(): void {
    while (this.outgoingQueue.length > 0) {
      const head = this.outgoingQueue[0];

      if (!this.isUsableFor(head)) return;

      if (
        head.destinationServePublicKey !== null &&
        CurrentServe.getPublicKey() !== head.destinationServePublicKey
      ) {
        this.outgoingQueue.shift();
        continue;
      }

      this.transmit(head);
      this.outgoingQueue.shift();
    }
  }

  // -------------------------------------------------------------------------
  // Handshake
  // -------------------------------------------------------------------------

  private async startHandshake(webSocket: WebSocket): Promise<void> {
    try {
      if (this.clientPrivateKey === null || this.clientPublicKey === null) {
        throw new Error("RemoteConnection.init() was not called");
      }
      if (this.webSocket !== webSocket) return;

      const packet: Packet = {
        peer: RESERVED_KEY,
        messageType: BigInt(REGISTER),
        payload: this.clientPublicKey,
      };

      const encoded = encodePacket(packet);

      console.info("[SIMServe][AUTH] sending REGISTER");
      this.send(encoded, null);
      this.startHandshakeTimer(webSocket);
    } catch (error) {
      console.warn("[SIMServe][AUTH] REGISTER failed", error);
      this.failHandshake(webSocket, "handshake initialization failed");
    }
  }

  private async handleBinaryMessage(
    webSocket: WebSocket,
    data: Uint8Array,
  ): Promise<void> {
    if (this.webSocket !== webSocket) return;

    let packet: Packet;
    try {
      packet = decodePacket(data);
    } catch (error) {
      console.warn("[SIMServe][AUTH] invalid packet", error);
      this.failHandshake(webSocket, "invalid packet");
      return;
    }

    const isAuthPacket = packet.messageType === BigInt(AUTHENTICATE);
    const isZeroPeer = packet.peer.every((b) => b === 0);

    // ---- Inbound peer guard for non-AUTH, non-ZERO packets.
    if (!isAuthPacket && !isZeroPeer) {
      const current = CurrentServe.get();
      if (current.publicKey === null) {
        console.warn(
          "[SIMServe][APP] dropping application packet: no current Serve",
        );
        return;
      }
      const expectedPeer = base64ToBytes(current.publicKey);
      if (!bytesEqual(packet.peer, expectedPeer)) {
        console.warn(
          `[SIMServe][APP] dropping application packet: peer does not match current Serve (peer=${bytesToBase64(packet.peer)} current=${current.publicKey})`,
        );
        return;
      }
    }

    // ---- AUTHENTICATE (id 1)
    if (isAuthPacket) {
      if (this.state === ConnectionState.CONNECTED) {
        // Already authenticated; ignore a redundant challenge.
        return;
      }
      await this.handleAuthChallenge(webSocket, packet);
      return;
    }

    // ---- Everything below requires a globally authenticated connection.
    if (this.state !== ConnectionState.CONNECTED) {
      console.warn(
        `[SIMServe][APP] dropping unauthenticated packet (type ${packet.messageType})`,
      );
      return;
    }

    // ---- ZERO peer: server events and responses.
    //
    // These are PLAINTEXT. No key lookup, no decrypt callable. The
    // server-event dispatcher does not resolve a `serveId`: ZERO is not
    // a Serve identity.
    if (isZeroPeer) {
      const typeNum = Number(packet.messageType);

      if (!isAllowedServerEvent(typeNum)) {
        console.warn(
          `[SIMServe][EVT] ignored non-allowed server event ${typeNum}`,
        );
        return;
      }

      const definition = MessageRegistry.get(typeNum);
      if (!definition) {
        console.warn(
          `[SIMServe][EVT] server event ${typeNum} has no MessageDefinition`,
        );
        return;
      }

      try {
        const payload = await pipeline.receive(
          definition as Parameters<typeof pipeline.receive>[0],
          packet.payload,
          null,
        );
        dispatchServerEventPayload(
          definition as Parameters<typeof dispatchServerEventPayload>[0],
          payload as Parameters<typeof dispatchServerEventPayload>[1],
        );
      } catch (error) {
        console.warn(
          `[SIMServe][EVT] failed to process ${definition.name}:`,
          error,
        );
      }
      return;
    }

    // ---- Non-ZERO application traffic from the current Serve.
    const current = CurrentServe.get();
    if (current.publicKey === null) {
      // Unreachable: the guard above returns when publicKey is null.
      return;
    }

    const definition = MessageRegistry.get(Number(packet.messageType));
    if (!definition) {
      console.warn(
        `[SIMServe][APP] no MessageDefinition for type ${packet.messageType}`,
      );
      return;
    }

    const key = SharedSecretCache.get(packet.peer);
    if (!key) {
      console.warn(
        `[SIMServe][APP] no cached shared secret for peer (type ${packet.messageType})`,
      );
      return;
    }

    try {
      const payload = await pipeline.receive(
        definition as Parameters<typeof pipeline.receive>[0],
        packet.payload,
        makeDecrypt(key),
      );
      await dispatchApplicationPayload(
        definition as Parameters<typeof dispatchApplicationPayload>[0],
        payload as Parameters<typeof dispatchApplicationPayload>[1],
        packet.peer,
      );
    } catch (error) {
      console.warn(
        `[SIMServe][APP] failed to process ${definition.name}:`,
        error,
      );
    }
  }

  private async handleAuthChallenge(
    webSocket: WebSocket,
    packet: Packet,
  ): Promise<void> {
    try {
      if (packet.messageType !== BigInt(AUTHENTICATE)) {
        throw new Error("Expected AUTHENTICATE");
      }
      if (packet.peer.length !== RESERVED_KEY.length) {
        throw new Error("Invalid server public key length");
      }
      const serverPublicKey = packet.peer;
      if (serverPublicKey.every((byte) => byte === 0)) {
        throw new Error("Server public key cannot be the reserved key");
      }
      if (packet.payload.length < 12 + 16) {
        throw new Error("Invalid authentication challenge length");
      }
      if (this.clientPrivateKey === null) {
        throw new Error("Client identity is not initialized");
      }

      console.info("[SIMServe][AUTH] received AUTHENTICATE challenge");
      console.info("[SIMServe][AUTH] deriving handshake key");

      const key = await derivePeerKey(this.clientPrivateKey, serverPublicKey);
      const aad = this.uint64ToBytes(packet.messageType);

      let nonce: Uint8Array;
      try {
        nonce = await decryptChallenge(key, packet.payload, aad);
      } catch (error) {
        console.warn("[SIMServe][AUTH] challenge decryption failed", error);
        throw error;
      }

      console.info("[SIMServe][AUTH] challenge decrypted");

      if (nonce.length !== CHALLENGE_SIZE) {
        throw new Error("Invalid nonce length");
      }
      if (this.webSocket !== webSocket) return;

      const response: Packet = {
        peer: RESERVED_KEY,
        messageType: BigInt(AUTHENTICATE),
        payload: nonce,
      };

      const encoded = encodePacket(response);

      console.info("[SIMServe][AUTH] sending authentication response");
      this.send(encoded, null);

      this.clearHandshakeTimer();
      this.connectedAt = Date.now();
      this.reconnectDelaySeconds = 1;
      this.setState(ConnectionState.CONNECTED);
      console.info("[SIMServe][AUTH] authenticated");

      // Drain any application packets queued during the handshake.
      this.drainQueue();

      // Notify the runtime once per successful authentication. The
      // runtime decides what to send (currently WATCH_PEERS).
      try {
        this.onAuthenticated?.();
      } catch (error) {
        console.warn(
          "[SIMServe][AUTH] onAuthenticated callback failed:",
          error,
        );
      }
    } catch (error) {
      console.warn("[SIMServe][AUTH] authentication failed", error);
      this.failHandshake(webSocket, "authentication failed");
    }
  }

  private startHandshakeTimer(webSocket: WebSocket): void {
    this.clearHandshakeTimer();
    this.handshakeTimer = setTimeout(() => {
      if (this.webSocket !== webSocket) return;
      console.warn("[SIMServe][AUTH] handshake timeout");
      this.failHandshake(webSocket, "handshake timeout");
    }, HANDSHAKE_TIMEOUT_MS);
  }

  private clearHandshakeTimer(): void {
    if (this.handshakeTimer === null) return;
    clearTimeout(this.handshakeTimer);
    this.handshakeTimer = null;
  }

  private failHandshake(webSocket: WebSocket, reason: string): void {
    if (this.webSocket !== webSocket) return;
    this.clearHandshakeTimer();
    console.warn(`[SIMServe][AUTH] closing connection: ${reason}`);
    webSocket.close(1008, reason);
  }

  private handleConnectionLost(webSocket: WebSocket): void {
    if (this.webSocket !== webSocket) return;

    this.clearHandshakeTimer();
    this.webSocket = null;
    // Do NOT null clientPrivateKey here.
    // Do NOT clear SharedSecretCache here.
    // Do NOT clear outgoingQueue here.

    this.setState(ConnectionState.DISCONNECTED);
    this.recordSurvival();

    if (this.shouldReconnect) this.scheduleReconnect();
  }

  private recordSurvival(): void {
    const survivalMs = this.connectedAt > 0 ? Date.now() - this.connectedAt : 0;
    this.connectedAt = 0;
    if (survivalMs >= HEALTHY_SURVIVAL_MS) {
      this.reconnectDelaySeconds = 1;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;
    const delay = this.reconnectDelaySeconds;
    console.info(`[SIMServe][WS] reconnecting in ${delay}s`);
    this.reconnectDelaySeconds = Math.min(
      this.reconnectDelaySeconds * 2,
      MAX_BACKOFF_SECONDS,
    );
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (
        !this.shouldReconnect ||
        this.state !== ConnectionState.DISCONNECTED
      ) {
        return;
      }
      await this.maybeRefreshConfig();
      this.connect();
    }, delay * 1000);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer === null) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private async maybeRefreshConfig(): Promise<void> {
    if (!configManager.shouldRefresh()) return;
    console.info("[SIMServe][CFG] refreshing remote config");
    try {
      await new ConfigRefresher().refresh();
    } catch (error) {
      console.warn("[SIMServe][CFG] config refresh failed", error);
    }
  }

  private uint64ToBytes(value: bigint): Uint8Array {
    const result = new Uint8Array(8);
    const view = new DataView(
      result.buffer,
      result.byteOffset,
      result.byteLength,
    );
    view.setBigUint64(0, value, false);
    return result;
  }

  private setState(newState: ConnectionState): void {
    if (this.state === newState) return;
    this.state = newState;
    this.callbacks.onStateChanged?.(newState);
  }
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export const remoteConnection = new RemoteConnection();
