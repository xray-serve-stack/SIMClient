// src/runtime/handlers/MarkConversationReadHandler.ts

import { updateConversationUnread } from "@/cache/chatRepository";
import { ResultType } from "@/runtime/results";
import type { Command } from "@/runtime/commands";
import type { CommandHandler, OutputWorkerResult } from "./types";

type Cmd = Extract<Command, { type: "MARK_CONVERSATION_READ" }>;

export const MarkConversationReadHandler: CommandHandler<Cmd> = {
  async execute(command): Promise<OutputWorkerResult> {
    await updateConversationUnread(command.serveId, command.number, false);
    return {
      results: [
        {
          type: ResultType.CONVERSATION_READ_RESULT,
          serveId: command.serveId,
          number: command.number,
          unread: false,
        },
      ],
      sends: [],
    };
  },
};
