// src/runtime/outputWorker.ts

import { commandQueue } from "./commandQueue";
import { inputQueue } from "./inputQueue";
import { CommandType, type Command } from "./commands";
import { buildEnvelope } from "./envelope";
import { ResultType } from "./results";
import type {
  CommandHandler,
  NetworkRequest,
  OutputWorkerResult,
} from "./handlers/types";
import { remoteConnection } from "@/network/RemoteConnection";

import { GetServesHandler } from "./handlers/GetServesHandler";
import { GetSimsHandler } from "./handlers/GetSimsHandler";
import { GetConversationsHandler } from "./handlers/GetConversationsHandler";
import { GetMessagesHandler } from "./handlers/GetMessagesHandler";
import { GetContactsHandler } from "./handlers/GetContactsHandler";
import { SendSmsHandler } from "./handlers/SendSmsHandler";
import { CreateServeHandler } from "./handlers/CreateServeHandler";
import { RenameServeHandler } from "./handlers/RenameServeHandler";
import { DeleteServeHandler } from "./handlers/DeleteServeHandler";
import { MarkConversationReadHandler } from "./handlers/MarkConversationReadHandler";
import { SyncHandler } from "./handlers/SyncHandler";
import { WatchPeersHandler } from "./handlers/WatchPeersHandler";

const handlers: Record<string, CommandHandler<Command>> = {
  [CommandType.GET_SERVES]: GetServesHandler as CommandHandler<Command>,
  [CommandType.GET_SIMS]: GetSimsHandler as CommandHandler<Command>,
  [CommandType.GET_CONVERSATIONS]:
    GetConversationsHandler as CommandHandler<Command>,
  [CommandType.GET_MESSAGES]: GetMessagesHandler as CommandHandler<Command>,
  [CommandType.GET_CONTACTS]: GetContactsHandler as CommandHandler<Command>,
  [CommandType.SEND_SMS]: SendSmsHandler as CommandHandler<Command>,
  [CommandType.CREATE_SERVE]: CreateServeHandler as CommandHandler<Command>,
  [CommandType.RENAME_SERVE]: RenameServeHandler as CommandHandler<Command>,
  [CommandType.DELETE_SERVE]: DeleteServeHandler as CommandHandler<Command>,
  [CommandType.MARK_CONVERSATION_READ]:
    MarkConversationReadHandler as CommandHandler<Command>,
  [CommandType.SYNC_STATUS]: SyncHandler as CommandHandler<Command>,
  [CommandType.WATCH_PEERS]: WatchPeersHandler as CommandHandler<Command>,
};

let running = false;
let loopPromise: Promise<void> | null = null;

const EMPTY_RESULT: OutputWorkerResult = { results: [], sends: [] };

async function performSends(sends: NetworkRequest[]): Promise<void> {
  for (const send of sends) {
    const payload = send.raw ? send.data : buildEnvelope(send.data);
    try {
      const sent = send.peerOverride
        ? await remoteConnection.sendApplicationWithPeer(
            payload,
            send.messageType,
            send.peerOverride,
          )
        : await remoteConnection.sendApplication(payload, send.messageType);
      if (!sent) {
        console.info(
          `[SIMServe][OUTPUT] network request not sent (type=${send.messageType})`,
        );
      }
    } catch (error) {
      console.warn(
        `[SIMServe][OUTPUT] network send failed (type=${send.messageType}):`,
        error,
      );
    }
  }
}

async function dispatch(command: Command): Promise<void> {
  const handler = handlers[command.type];
  if (!handler) {
    inputQueue.enqueue({
      type: ResultType.OPERATION_FAILED_RESULT,
      command,
      error: new Error(
        `No handler registered for command type: ${command.type}`,
      ),
    });
    return;
  }

  const output = (await handler.execute(command)) ?? EMPTY_RESULT;

  for (const result of output.results) {
    inputQueue.enqueue(result);
  }

  await performSends(output.sends);
}

function logOutputIntent(command: Command): void {
  const serveId =
    "serveId" in command && typeof command.serveId === "number"
      ? command.serveId
      : "n/a";
  console.info(`[SIMServe][OUTPUT] intent: ${command.type} serveId=${serveId}`);
}

async function loop(): Promise<void> {
  while (running) {
    let command: Command;
    try {
      command = await commandQueue.take();
    } catch (error) {
      console.error("[OutputWorker] take() failed:", error);
      continue;
    }
    logOutputIntent(command);
    try {
      await dispatch(command);
    } catch (error) {
      console.error("[OutputWorker] command failed:", command, error);
      inputQueue.enqueue({
        type: ResultType.OPERATION_FAILED_RESULT,
        command,
        error,
      });
    }
  }
}

export function startOutputWorker(): void {
  if (running) return;
  running = true;
  loopPromise = loop();
}

export function stopOutputWorker(): void {
  running = false;
  void loopPromise;
}
