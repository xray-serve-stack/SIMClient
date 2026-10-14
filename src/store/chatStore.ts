// src/store/chatStore.ts

import { SharedSecretCache } from "@/network/SharedSecretCache";
import {
  getOrCreateClientIdentity,
  base64ToBytes,
} from "@/cache/clientIdentity";
import { CurrentServe } from "@/runtime/currentServe";
import { create } from "zustand";
import type { Contact, Conversation, Message, Sim } from "@/types";
import type { Serve } from "@/cache/servesRepository";
import { CommandType } from "@/runtime/commands";
import { enqueueCommand } from "@/runtime/commandQueue";
import { getDefaultSim } from "@/store/simsHelpers";

interface ChatState {
  serves: Serve[];
  activeServeId: number | null;
  servePresence: Record<number, "online" | "offline">;

  sims: Sim[];
  conversations: Conversation[];
  messages: Record<string, Message[]>;
  drafts: Record<string, string>;
  contacts: Contact[];
  activeChat: string | null;
  isLoading: boolean;
  lastSendError: string | null;

  selectedSubscriptionId: number | null;

  clearLastSendError: () => void;

  requestServes: () => void;
  requestInitialData: () => void;

  setActiveServe: (serveId: number) => Promise<void>;
  /**
   * Switch the active Serve and resolve once the target conversation (if
   * provided) is present in the store's `conversations` slice, or once
   * `timeoutMs` elapses.
   *
   * When `serveId` is already the active Serve, resolves immediately
   * without re-enqueuing SYNC_STATUS.
   */
  setActiveServeAndWait: (
    serveId: number,
    number: string,
    timeoutMs?: number,
  ) => Promise<void>;
  setActiveChat: (number: string | null) => void;
  requestMessages: (number: string) => void;
  requestContacts: () => void;

  setSelectedSubscriptionId: (id: number | null) => void;

  sendSms: (recipient: string, body: string) => void;

  getConversationByNumber: (number: string) => Conversation | undefined;
  getMessagesForNumber: (number: string) => Message[];

  createServe: (public_key: string, device_name: string) => void;
  renameServe: (id: number, device_name: string) => void;
  deleteServe: (id: number) => void;

  scrollToMessage: { number: string; timestamp: number } | null;
  setScrollToMessage: (
    target: { number: string; timestamp: number } | null,
  ) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  serves: [],
  activeServeId: null,
  servePresence: {},

  sims: [],
  conversations: [],
  messages: {},
  drafts: {},
  contacts: [],
  activeChat: null,
  isLoading: true,
  lastSendError: null,
  selectedSubscriptionId: null,
  scrollToMessage: null,

  clearLastSendError: () => set({ lastSendError: null }),

  requestServes: () => {
    enqueueCommand({ type: CommandType.GET_SERVES });
  },

  requestInitialData: () => {
    get().requestServes();
  },

  setActiveServe: async (serveId) => {
    const serve = get().serves.find((s) => s.id === serveId);
    if (!serve) {
      console.warn(
        `[SIMServe][SERVE] setActiveServe: unknown serveId=${serveId}`,
      );
      return;
    }

    set({ activeChat: null, selectedSubscriptionId: null });

    CurrentServe.set(serveId, serve.public_key);
    set({ activeServeId: serveId });

    console.info(
      `[SIMServe][SERVE] active serve changed: serveId=${serveId} pub=${serve.public_key}`,
    );

    let ready = true;
    try {
      const identity = await getOrCreateClientIdentity();
      const clientPrivateKey = base64ToBytes(identity.privateKeyB64);
      await SharedSecretCache.ensure(serve.public_key, clientPrivateKey);
      console.info(
        `[SIMServe][SERVE] shared secret ready: serveId=${serveId} pub=${serve.public_key}`,
      );
    } catch (error) {
      ready = false;
      console.error(
        `[SIMServe][SERVE] shared secret unavailable for serveId=${serveId}:`,
        error,
      );
      set({ lastSendError: "Shared secret unavailable for active Serve" });
    }

    if (!ready) return;

    enqueueCommand({ type: CommandType.SYNC_STATUS, serveId });
  },

  setActiveChat: (number) => {
    set({ activeChat: number });
    const { activeServeId } = get();
    if (number && activeServeId !== null) {
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.number === number ? { ...c, unread: false } : c,
        ),
      }));
      enqueueCommand({
        type: CommandType.MARK_CONVERSATION_READ,
        serveId: activeServeId,
        number,
      });
      get().requestMessages(number);
    }
  },

  requestMessages: (number) => {
    const { activeServeId, sims } = get();
    if (activeServeId === null) return;
    const subscription_ids = sims.map((s) => s.subscription_id);
    enqueueCommand({
      type: CommandType.GET_MESSAGES,
      serveId: activeServeId,
      subscription_ids,
      number,
    });
  },

  requestContacts: () => {
    const { activeServeId } = get();
    if (activeServeId === null) return;
    enqueueCommand({ type: CommandType.GET_CONTACTS, serveId: activeServeId });
  },

  setSelectedSubscriptionId: (id) => {
    set({ selectedSubscriptionId: id });
  },

  sendSms: (recipient, body) => {
    const { activeServeId, sims, selectedSubscriptionId } = get();
    if (activeServeId === null) {
      set({ lastSendError: "No active Serve" });
      return;
    }

    const selected =
      selectedSubscriptionId !== null
        ? sims.find((s) => s.subscription_id === selectedSubscriptionId)
        : undefined;
    const chosen = selected ?? getDefaultSim(sims);

    if (!chosen) {
      set({ lastSendError: "No SIM available" });
      return;
    }
    set({ lastSendError: null });
    enqueueCommand({
      type: CommandType.SEND_SMS,
      serveId: activeServeId,
      payload: {
        recipient,
        body,
        subscription_id: chosen.subscription_id,
      },
    });
  },

  getConversationByNumber: (number) =>
    get().conversations.find((c) => c.number === number),
  getMessagesForNumber: (number) => get().messages[number] ?? [],

  createServe: (public_key, device_name) => {
    enqueueCommand({
      type: CommandType.CREATE_SERVE,
      public_key,
      device_name,
    });
  },

  renameServe: (id, device_name) => {
    enqueueCommand({
      type: CommandType.RENAME_SERVE,
      id,
      device_name,
    });
  },

  deleteServe: (id) => {
    enqueueCommand({
      type: CommandType.DELETE_SERVE,
      id,
    });
  },
  setScrollToMessage: (target) => set({ scrollToMessage: target }),
  setActiveServeAndWait: async (serveId, number, timeoutMs = 3000) => {
    const state = get();
    const alreadyActive = state.activeServeId === serveId;

    if (!alreadyActive) {
      await get().setActiveServe(serveId);
    }

    // If the conversation is already in the store, no need to wait.
    if (get().conversations.some((c) => c.number === number)) return;

    // If the serve failed to switch (unknown serveId), return without
    // waiting. The caller will still navigate; the chat view will show an
    // empty conversation.
    if (get().activeServeId !== serveId) return;

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        unsub();
        resolve();
      }, timeoutMs);

      const unsub = useChatStore.subscribe((s) => {
        if (s.activeServeId !== serveId) {
          // Serve changed out from under us; stop waiting.
          clearTimeout(timeout);
          unsub();
          resolve();
          return;
        }
        if (s.conversations.some((c) => c.number === number)) {
          clearTimeout(timeout);
          unsub();
          resolve();
        }
      });
    });
  },
}));
