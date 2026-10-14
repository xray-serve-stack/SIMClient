// src/runtime/handlers/GetMessagesHandler.ts

import { getMessages } from "@/cache/chatRepository";
import { GET_MESSAGES } from "@/network/messageDefinitions/GET_MESSAGES";
import { GetMessagesCommand } from "@/network/messageDefinitions/GetMessagesCommand";
import { ResultType } from "@/runtime/results";
import type { Command } from "@/runtime/commands";
import type { CommandHandler, OutputWorkerResult } from "./types";
import type { Message, PersistedMessage } from "@/types";

type Cmd = Extract<Command, { type: "GET_MESSAGES" }>;

const getMessagesCommand = new GetMessagesCommand();

function statusForMessageType(type: number): Message["status"] {
  switch (type) {
    case 2:
      return "sent";
    case 4:
      return "outbox";
    case 5:
      return "failed";
    case 6:
      return "queued";
    default:
      return null;
  }
}

/**
 * Transform persisted rows into the UI-facing message list and the
 * conversation draft.
 *
 * DRAFT rows (messageType === 3) are removed from the timeline and
 * surfaced as the draft string. All other rows become `Message`.
 *
 * Pure. Exported so any producer of a MESSAGES_RESULT (cache read,
 * post-response re-read) uses the same transform.
 */
export function buildMessagesResult(persisted: PersistedMessage[]): {
  history: Message[];
  draft: string | null;
} {
  const history: Message[] = [];
  let draft: string | null = null;

  for (const p of persisted) {
    if (p.messageType === 3 /* DRAFT */) {
      draft = p.body;
      continue;
    }
    history.push({
      serveId: p.serveId,
      body: p.body,
      timestamp: p.timestamp,
      isIncoming: p.messageType === 1 /* INBOX */,
      subscription_id: p.subscription_id,
      status: statusForMessageType(p.messageType),
    });
  }

  return { history, draft };
}

/**
 * Read the persisted messages for one conversation and produce the
 * MESSAGES_RESULT payload for it. Pure cache read; no network.
 *
 * Used both by the handler (pre-request publish) and by the id-13
 * dispatcher route (post-persistence publish).
 */
export async function readMessagesForResult(
  serveId: number,
  number: string,
): Promise<{ history: Message[]; draft: string | null }> {
  const persisted = await getMessages(serveId, number);
  return buildMessagesResult(persisted);
}

export const GetMessagesHandler: CommandHandler<Cmd> = {
  async execute(command): Promise<OutputWorkerResult> {
    const results: OutputWorkerResult["results"] = [];
    const sends: OutputWorkerResult["sends"] = [];

    try {
      const { history, draft } = await readMessagesForResult(
        command.serveId,
        command.number,
      );
      results.push({
        type: ResultType.MESSAGES_RESULT,
        serveId: command.serveId,
        number: command.number,
        data: history,
        draft,
      });
    } catch (error) {
      console.warn("[SIMServe][OUTPUT] GET_MESSAGES cache read failed:", error);
    }

    try {
      const data = await getMessagesCommand.buildGetMessagesData({
        serveId: command.serveId,
        number: command.number,
        start: command.start,
      });
      sends.push({ messageType: GET_MESSAGES.id, data });
    } catch (error) {
      console.warn(
        "[SIMServe][OUTPUT] GET_MESSAGES request build failed:",
        error,
      );
    }

    return { results, sends };
  },
};
