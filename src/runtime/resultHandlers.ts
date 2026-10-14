// src/runtime/resultHandlers.ts

import { CurrentServe } from "@/runtime/currentServe";
import {
  getConversations,
  getLatestMessageByType,
  getSims,
  saveSims,
  updateMessageType,
} from "@/cache/chatRepository";
import { useChatStore } from "@/store/chatStore";
import { CommandType } from "./commands";
import { enqueueCommand } from "./commandQueue";
import { ResultType, type Result } from "./results";
import { SyncStatusCommand } from "@/network/messageDefinitions/SyncStatusCommand";
import { readMessagesForResult } from "@/runtime/handlers/GetMessagesHandler";
import type { Message } from "@/types";

const syncStatusCommand = new SyncStatusCommand();

type ResultHandler = (result: Result) => void;

export const resultHandlers: Record<string, ResultHandler> = {
  [ResultType.SERVES_RESULT]: (result) => {
    if (result.type !== ResultType.SERVES_RESULT) return;
    const first = result.data[0];
    useChatStore.setState({
      serves: result.data,
      activeServeId: first?.id ?? null,
    });
    if (typeof first?.id === "number" && typeof first.public_key === "string") {
      CurrentServe.set(first.id, first.public_key);
      console.info(
        `[SIMServe][SERVE] active serve changed: serveId=${first.id} pub=${first.public_key}`,
      );
      enqueueCommand({ type: CommandType.SYNC_STATUS, serveId: first.id });
    } else {
      CurrentServe.clear();
    }
  },

  [ResultType.SIMS_RESULT]: (result) => {
    if (result.type !== ResultType.SIMS_RESULT) return;

    void saveSims(result.serveId, result.data);

    const activeServeId = useChatStore.getState().activeServeId;
    if (activeServeId === null) return;
    if (result.serveId !== activeServeId) return;

    useChatStore.setState({ sims: result.data });
  },

  [ResultType.CONVERSATIONS_RESULT]: (result) => {
    if (result.type !== ResultType.CONVERSATIONS_RESULT) return;
    if (result.serveId !== useChatStore.getState().activeServeId) return;
    useChatStore.setState({
      conversations: result.data,
      isLoading: false,
    });
  },

  [ResultType.SYNC_STATUS_RESULT]: (result) => {
    if (result.type !== ResultType.SYNC_STATUS_RESULT) return;

    const activeServeId = useChatStore.getState().activeServeId;
    if (activeServeId === null) return;
    if (result.serveId !== activeServeId) return;

    const serveId = result.serveId;

    void (async () => {
      try {
        await syncStatusCommand.processSyncStatusResult(
          serveId,
          result.response,
        );
      } catch (error) {
        console.error(
          `[SIMServe][INPUT] SYNC_STATUS persistence failed (serveId=${serveId}):`,
          error,
        );
        return;
      }

      if (useChatStore.getState().activeServeId !== serveId) return;

      try {
        const [sims, conversations] = await Promise.all([
          getSims(serveId),
          getConversations(serveId),
        ]);
        if (useChatStore.getState().activeServeId !== serveId) return;
        useChatStore.setState({ sims, conversations, isLoading: false });
        console.info(
          `[SIMServe][INPUT] SYNC_STATUS applied: serveId=${serveId} sims=${sims.length} conversations=${conversations.length}`,
        );
      } catch (error) {
        console.error(
          `[SIMServe][INPUT] SYNC_STATUS store refresh failed (serveId=${serveId}):`,
          error,
        );
      }
    })();
  },

  [ResultType.MESSAGES_RESULT]: (result) => {
    if (result.type !== ResultType.MESSAGES_RESULT) return;
    if (result.serveId !== useChatStore.getState().activeServeId) return;
    useChatStore.setState((state) => ({
      messages: { ...state.messages, [result.number]: result.data },
      drafts: { ...state.drafts, [result.number]: result.draft ?? "" },
    }));
  },

  [ResultType.CONTACTS_RESULT]: (result) => {
    if (result.type !== ResultType.CONTACTS_RESULT) return;
    if (result.serveId !== useChatStore.getState().activeServeId) return;
    useChatStore.setState({ contacts: result.data });
  },

  [ResultType.CONVERSATION_READ_RESULT]: () => {
    // Optimistically handled by setActiveChat.
  },

  [ResultType.SERVE_CREATED_RESULT]: (result) => {
    if (result.type !== ResultType.SERVE_CREATED_RESULT) return;
    const { serves } = useChatStore.getState();
    const next = [...serves, result.serve].sort(
      (a, b) => (a.id ?? 0) - (b.id ?? 0),
    );
    useChatStore.setState({
      serves: next,
      activeServeId: result.serve.id ?? null,
    });
    const serveId = result.serve.id;
    if (
      typeof serveId === "number" &&
      typeof result.serve.public_key === "string"
    ) {
      CurrentServe.set(serveId, result.serve.public_key);
      console.info(
        `[SIMServe][SERVE] active serve changed: serveId=${serveId} pub=${result.serve.public_key}`,
      );
      enqueueCommand({ type: CommandType.SYNC_STATUS, serveId });
    } else {
      CurrentServe.clear();
    }
  },

  [ResultType.SERVE_RENAMED_RESULT]: (result) => {
    if (result.type !== ResultType.SERVE_RENAMED_RESULT) return;
    useChatStore.setState((state) => ({
      serves: state.serves.map((s) =>
        s.id === result.serve.id ? result.serve : s,
      ),
    }));
  },

  [ResultType.SERVE_DELETED_RESULT]: (result) => {
    if (result.type !== ResultType.SERVE_DELETED_RESULT) return;
    const { activeServeId: before, serves: servesBefore } =
      useChatStore.getState();
    const isActive = before === result.id;
    const servesAfter = servesBefore.filter((s) => s.id !== result.id);

    useChatStore.setState((state) => {
      const { [result.id]: _removed, ...servePresence } = state.servePresence;
      void _removed;
      return {
        serves: servesAfter,
        servePresence,
        activeServeId: isActive
          ? (servesAfter[0]?.id ?? null)
          : state.activeServeId,
      };
    });

    if (isActive) {
      const next = servesAfter[0];
      if (
        next &&
        typeof next.id === "number" &&
        typeof next.public_key === "string"
      ) {
        CurrentServe.set(next.id, next.public_key);
        console.info(
          `[SIMServe][SERVE] active serve changed: serveId=${next.id} pub=${next.public_key}`,
        );
        enqueueCommand({ type: CommandType.SYNC_STATUS, serveId: next.id });
      } else {
        CurrentServe.clear();
        useChatStore.setState({
          sims: [],
          conversations: [],
          messages: {},
          drafts: {},
          contacts: [],
          activeChat: null,
        });
      }
    }
  },

  [ResultType.SERVE_WRITE_FAILED_RESULT]: (result) => {
    if (result.type !== ResultType.SERVE_WRITE_FAILED_RESULT) return;
    console.error(
      "[InputWorker] Serve write failed:",
      result.operation,
      result.message,
    );
    useChatStore.setState({ lastSendError: result.message });
  },

  [ResultType.SMS_OUTBOX_RESULT]: (result) => {
    if (result.type !== ResultType.SMS_OUTBOX_RESULT) return;
    if (result.serveId !== useChatStore.getState().activeServeId) return;

    useChatStore.setState((state) => {
      const existing = state.messages[result.number] ?? [];
      const optimistic: Message = {
        serveId: result.serveId,
        body: result.body,
        timestamp: result.timestamp,
        isIncoming: false,
        subscription_id: result.subscription_id,
        status: "outbox",
      };
      return {
        messages: {
          ...state.messages,
          [result.number]: [...existing, optimistic],
        },
      };
    });
  },

  [ResultType.SMS_STATUS_RESULT]: (result) => {
    if (result.type !== ResultType.SMS_STATUS_RESULT) return;
    if (result.serveId !== useChatStore.getState().activeServeId) return;

    const number = useChatStore.getState().activeChat;
    if (number === null) {
      console.warn(
        "[SIMServe][INPUT] SMS_STATUS_RESULT arrived with no active chat; dropping",
      );
      return;
    }

    const targetType = result.accepted ? 2 /* SENT */ : 5; /* FAILED */

    void (async () => {
      try {
        const outbox = await getLatestMessageByType(
          result.serveId,
          number,
          4 /* OUTBOX */,
        );
        if (outbox === null) {
          console.warn(
            `[SIMServe][INPUT] SMS_STATUS_RESULT: no OUTBOX row for (serveId=${result.serveId}, number=${number})`,
          );
          return;
        }

        await updateMessageType(
          result.serveId,
          number,
          outbox.timestamp,
          targetType,
        );

        if (useChatStore.getState().activeServeId !== result.serveId) return;
        if (useChatStore.getState().activeChat !== number) return;

        const { history, draft } = await readMessagesForResult(
          result.serveId,
          number,
        );
        useChatStore.setState((state) => ({
          messages: { ...state.messages, [number]: history },
          drafts: { ...state.drafts, [number]: draft ?? "" },
        }));
      } catch (error) {
        console.error("[SIMServe][INPUT] SMS_STATUS_RESULT failed:", error);
      }
    })();
  },

  [ResultType.SMS_SENT_RESULT]: () => {
    // SendSmsHandler no longer emits this. Kept for compatibility.
  },

  [ResultType.SMS_SEND_FAILED_RESULT]: (result) => {
    if (result.type !== ResultType.SMS_SEND_FAILED_RESULT) return;
    if (result.serveId !== useChatStore.getState().activeServeId) return;
    console.error(
      "[InputWorker] SMS send failed:",
      result.payload,
      result.error,
    );
    useChatStore.setState({ lastSendError: "Failed to send SMS" });
  },

  [ResultType.OPERATION_FAILED_RESULT]: (result) => {
    if (result.type !== ResultType.OPERATION_FAILED_RESULT) return;
    console.error(
      "[InputWorker] operation failed:",
      result.command,
      result.error,
    );
  },
  [ResultType.PRESENCE_RESULT]: (result) => {
    if (result.type !== ResultType.PRESENCE_RESULT) return;
    const { serves } = useChatStore.getState();
    const online = new Set(result.onlinePublicKeys);
    const next: Record<number, "online" | "offline"> = {};
    for (const s of serves) {
      if (typeof s.id !== "number") continue;
      next[s.id] = online.has(s.public_key) ? "online" : "offline";
    }
    useChatStore.setState({ servePresence: next });
  },
  [ResultType.PRESENCE_EVENT_RESULT]: (result) => {
    if (result.type !== ResultType.PRESENCE_EVENT_RESULT) return;

    const { serves, servePresence } = useChatStore.getState();
    const target = serves.find((s) => s.public_key === result.publicKey);
    if (!target || typeof target.id !== "number") return;

    if (servePresence[target.id] === (result.online ? "online" : "offline")) {
      return;
    }

    useChatStore.setState((state) => ({
      servePresence: {
        ...state.servePresence,
        [target.id as number]: result.online ? "online" : "offline",
      },
    }));
  },
};

export function resolveResultType(result: Result): string {
  return result.type;
}
