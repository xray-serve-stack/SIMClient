// src/runtime/commands.ts

import type { SendSmsPayload } from "@/types";

export const CommandType = {
  GET_SERVES: "GET_SERVES",
  CREATE_SERVE: "CREATE_SERVE",
  RENAME_SERVE: "RENAME_SERVE",
  DELETE_SERVE: "DELETE_SERVE",

  GET_SIMS: "GET_SIMS",
  GET_CONVERSATIONS: "GET_CONVERSATIONS",
  GET_MESSAGES: "GET_MESSAGES",
  GET_CONTACTS: "GET_CONTACTS",

  SEND_SMS: "SEND_SMS",

  SYNC_STATUS: "SYNC_STATUS",

  WATCH_PEERS: "WATCH_PEERS",

  MARK_CONVERSATION_READ: "MARK_CONVERSATION_READ",
} as const;

export type CommandType = (typeof CommandType)[keyof typeof CommandType];

export type SubscriptionId = number;
export type SubscriptionIds = SubscriptionId[];

export type Command =
  | { type: typeof CommandType.GET_SERVES }
  | {
      type: typeof CommandType.CREATE_SERVE;
      public_key: string;
      device_name: string;
    }
  | { type: typeof CommandType.RENAME_SERVE; id: number; device_name: string }
  | { type: typeof CommandType.DELETE_SERVE; id: number }
  | { type: typeof CommandType.GET_SIMS; serveId: number }
  | {
      type: typeof CommandType.GET_CONVERSATIONS;
      serveId: number;
      subscription_ids: SubscriptionIds;
    }
  | {
      type: typeof CommandType.GET_MESSAGES;
      serveId: number;
      subscription_ids: SubscriptionIds;
      number: string;
      start?: number | null;
      cached_count?: number | null;
    }
  | { type: typeof CommandType.GET_CONTACTS; serveId: number }
  | {
      type: typeof CommandType.SEND_SMS;
      serveId: number;
      payload: SendSmsPayload;
    }
  | { type: typeof CommandType.SYNC_STATUS; serveId: number }
  | { type: typeof CommandType.WATCH_PEERS }
  | {
      type: typeof CommandType.MARK_CONVERSATION_READ;
      serveId: number;
      number: string;
    };
