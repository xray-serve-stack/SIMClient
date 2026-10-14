// src/runtime/results.ts

import type {
  Contact,
  Conversation,
  Message,
  SendSmsPayload,
  Sim,
} from "@/types";
import type { Serve } from "@/cache/servesRepository";
import type { SyncStatusResponse } from "@/network/messageDefinitions/SYNC_STATUS";

export const ResultType = {
  SERVES_RESULT: "SERVES_RESULT",
  SERVE_CREATED_RESULT: "SERVE_CREATED_RESULT",
  SERVE_RENAMED_RESULT: "SERVE_RENAMED_RESULT",
  SERVE_DELETED_RESULT: "SERVE_DELETED_RESULT",
  SERVE_WRITE_FAILED_RESULT: "SERVE_WRITE_FAILED_RESULT",

  SIMS_RESULT: "SIMS_RESULT",
  CONVERSATIONS_RESULT: "CONVERSATIONS_RESULT",
  MESSAGES_RESULT: "MESSAGES_RESULT",
  CONTACTS_RESULT: "CONTACTS_RESULT",

  SYNC_STATUS_RESULT: "SYNC_STATUS_RESULT",
  PRESENCE_RESULT: "PRESENCE_RESULT",
  PRESENCE_EVENT_RESULT: "PRESENCE_EVENT_RESULT",

  CONVERSATION_READ_RESULT: "CONVERSATION_READ_RESULT",

  SMS_SENT_RESULT: "SMS_SENT_RESULT",
  SMS_SEND_FAILED_RESULT: "SMS_SEND_FAILED_RESULT",

  OPERATION_FAILED_RESULT: "OPERATION_FAILED_RESULT",

  SMS_OUTBOX_RESULT: "SMS_OUTBOX_RESULT",
  SMS_STATUS_RESULT: "SMS_STATUS_RESULT",
} as const;

export type ResultType = (typeof ResultType)[keyof typeof ResultType];

export type Result =
  | { type: typeof ResultType.SERVES_RESULT; data: Serve[] }
  | { type: typeof ResultType.SERVE_CREATED_RESULT; serve: Serve }
  | { type: typeof ResultType.SERVE_RENAMED_RESULT; serve: Serve }
  | { type: typeof ResultType.SERVE_DELETED_RESULT; id: number }
  | {
      type: typeof ResultType.SERVE_WRITE_FAILED_RESULT;
      operation: "create" | "rename" | "delete";
      message: string;
    }
  | { type: typeof ResultType.SIMS_RESULT; serveId: number; data: Sim[] }
  | {
      type: typeof ResultType.CONVERSATIONS_RESULT;
      serveId: number;
      data: Conversation[];
    }
  | {
      type: typeof ResultType.MESSAGES_RESULT;
      serveId: number;
      number: string;
      data: Message[];
      draft: string | null;
    }
  | {
      type: typeof ResultType.CONTACTS_RESULT;
      serveId: number;
      data: Contact[];
    }
  | {
      type: typeof ResultType.CONVERSATION_READ_RESULT;
      serveId: number;
      number: string;
      unread: boolean;
    }
  | {
      type: typeof ResultType.SMS_SENT_RESULT;
      serveId: number;
      payload: SendSmsPayload;
    }
  | {
      type: typeof ResultType.SMS_SEND_FAILED_RESULT;
      serveId: number;
      payload: SendSmsPayload;
      error: unknown;
    }
  | {
      type: typeof ResultType.OPERATION_FAILED_RESULT;
      command: unknown;
      error: unknown;
    }
  | {
      type: typeof ResultType.SMS_OUTBOX_RESULT;
      serveId: number;
      number: string;
      body: string;
      subscription_id: number;
      timestamp: number;
    }
  | {
      type: typeof ResultType.SMS_STATUS_RESULT;
      serveId: number;
      accepted: boolean;
      reason?: string;
    }
  | {
      type: typeof ResultType.SYNC_STATUS_RESULT;
      serveId: number;
      response: SyncStatusResponse;
    }
  | {
      type: typeof ResultType.PRESENCE_RESULT;
      onlinePublicKeys: string[];
    }
  | {
      type: typeof ResultType.PRESENCE_EVENT_RESULT;
      publicKey: string;
      online: boolean;
    };
