// src/runtime/handlers/SendSmsHandler.ts

import { insertMessage } from "@/cache/chatRepository";
import { SEND_SMS } from "@/network/messageDefinitions/SEND_SMS";
import { ResultType } from "@/runtime/results";
import type { Command } from "@/runtime/commands";
import type { CommandHandler, OutputWorkerResult } from "./types";

type Cmd = Extract<Command, { type: "SEND_SMS" }>;

const OUTBOX_TYPE = 4;

/**
 * Local-first SEND_SMS.
 *
 *   1. Persist an OUTBOX row for (serveId, recipient, now).
 *   2. Publish SMS_OUTBOX_RESULT so the store shows the message
 *      immediately with an "outbox" status.
 *   3. Send the SEND_SMS request. The response is handled by the id-15
 *      route in ApplicationDispatcher, which publishes SMS_STATUS_RESULT.
 *
 * The recipient in the payload is the phone number, not the contact
 * name. The subscription_id is the canonical SIM identity; the ordinal
 * shown in the UI is derived from the current SIM list.
 */
export const SendSmsHandler: CommandHandler<Cmd> = {
  async execute(command): Promise<OutputWorkerResult> {
    const results: OutputWorkerResult["results"] = [];
    const sends: OutputWorkerResult["sends"] = [];

    const { recipient, body, subscription_id } = command.payload;
    const timestamp = Date.now();

    try {
      await insertMessage({
        serveId: command.serveId,
        number: recipient,
        timestamp,
        body,
        subscription_id,
        messageType: OUTBOX_TYPE,
      });
      results.push({
        type: ResultType.SMS_OUTBOX_RESULT,
        serveId: command.serveId,
        number: recipient,
        body,
        subscription_id,
        timestamp,
      });
    } catch (error) {
      results.push({
        type: ResultType.SMS_SEND_FAILED_RESULT,
        serveId: command.serveId,
        payload: command.payload,
        error,
      });
      return { results, sends };
    }

    sends.push({
      messageType: SEND_SMS.id,
      data: {
        subscription_id,
        number: recipient,
        body,
      },
    });

    return { results, sends };
  },
};
