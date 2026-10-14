// src/runtime/handlers/GetContactsHandler.ts

import { getContacts } from "@/cache/chatRepository";
import { ResultType } from "@/runtime/results";
import type { Command } from "@/runtime/commands";
import type { CommandHandler, OutputWorkerResult } from "./types";

type Cmd = Extract<Command, { type: "GET_CONTACTS" }>;

export const GetContactsHandler: CommandHandler<Cmd> = {
  async execute(command): Promise<OutputWorkerResult> {
    const data = await getContacts(command.serveId);
    return {
      results: [
        { type: ResultType.CONTACTS_RESULT, serveId: command.serveId, data },
      ],
      sends: [],
    };
  },
};
