// src/runtime/inputWorker.ts

import { inputQueue } from "./inputQueue";
import { resolveResultType, resultHandlers } from "./resultHandlers";
import type { Result } from "./results";

let running = false;
let loopPromise: Promise<void> | null = null;

function dispatch(result: Result): void {
  const type = resolveResultType(result);
  const handler = resultHandlers[type];

  if (!handler) {
    console.warn("[InputWorker] no handler registered for result type:", type);
    return;
  }

  try {
    handler(result);
  } catch (error) {
    console.error("[InputWorker] handler failed for type:", type, error);
  }
}

function logInputIntent(result: Result): void {
  const serveId =
    "serveId" in result && typeof result.serveId === "number"
      ? result.serveId
      : "n/a";
  console.info(`[SIMServe][INPUT] intent: ${result.type} serveId=${serveId}`);
}

async function loop(): Promise<void> {
  while (running) {
    let result: Result;
    try {
      result = await inputQueue.take();
    } catch (error) {
      console.error("[InputWorker] take() failed:", error);
      continue;
    }

    logInputIntent(result);
    dispatch(result);
  }
}

export function startInputWorker(): void {
  if (running) return;
  running = true;
  loopPromise = loop();
}

export function stopInputWorker(): void {
  running = false;
  void loopPromise;
}
