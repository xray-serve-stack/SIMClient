// src/types/index.ts

/**
 * Wire contract for one SIM in a GET_SIMS response. Field names match the
 * Serve/Serve protocol exactly (snake_case).
 */
export interface SimDescriptor {
  subscription_id: number;
  slot_index: number;
  number: string | null;
  carrier_name: string | null;
  display_name: string | null;
  country_iso: string | null;
  mcc: number | null;
  mnc: number | null;
  is_default_sms: boolean;
}

/**
 * Persisted SIM record.
 *
 * `subscription_id` is the canonical SIM identity. `ordinal` is a
 * presentation value derived as `array index + 1` from the GET_SIMS
 * response; it is not identity, not Android, and not part of the store
 * key path.
 */
export interface Sim {
  serveId: number;
  subscription_id: number;
  slot_index: number;
  number: string | null;
  carrier_name: string | null;
  display_name: string | null;
  country_iso: string | null;
  mcc: number | null;
  mnc: number | null;
  is_default_sms: boolean;
  ordinal: number;
}

/**
 * UI-facing message.
 *
 * `subscription_id` is the canonical SIM identity of the message's SIM.
 * `isIncoming` is derived from the persisted `messageType` (true iff
 * INBOX). `status` is a display hint derived from `messageType`.
 *
 * The SIM label shown in the UI is derived by the component from the
 * current SIM list via `subscriptionIdToOrdinal`; the message itself
 * carries only `subscription_id`.
 */
export interface Message {
  serveId: number;
  body: string;
  timestamp: number;
  isIncoming: boolean;
  subscription_id: number;
  status: "sent" | "outbox" | "queued" | "failed" | null;
}

/**
 * Persisted message record.
 *
 * One row per Android SMS message. Primary key is
 * `["serveId", "number", "timestamp"]`. `subscription_id` is the
 * canonical SIM identity of the message's SIM. `messageType` is the
 * Android SMS type, 1..6:
 *   1 INBOX, 2 SENT, 3 DRAFT, 4 OUTBOX, 5 FAILED, 6 QUEUED.
 */
export interface PersistedMessage {
  serveId: number;
  number: string;
  timestamp: number;
  body: string;
  subscription_id: number;
  messageType: number;
}

/**
 * A conversation.
 *
 * `selectedSimForSend` is intentionally absent. SIM selection is now
 * derived from the current SIM list by the pure helpers in
 * `src/store/simsHelpers.ts`.
 */
export interface Conversation {
  serveId: number;
  number: string;
  contactName: string;
  preview: string;
  timestamp: number;
  unread: boolean;
}

export interface Contact {
  serveId: number;
  id: string;
  displayName: string;
  number: string;
}

export interface MessageGroup {
  date: Date;
  messages: Message[];
}

export interface SendSmsPayload {
  recipient: string;
  body: string;
  subscription_id: number;
}
