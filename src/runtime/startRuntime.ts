// src/runtime/startRuntime.ts

import { startOutputWorker } from "./outputWorker";
import { startInputWorker } from "./inputWorker";

/**
 * Boots the asynchronous pipeline. Must be called once, after IndexedDB has
 * been seeded, before any command is enqueued.
 */
export function startRuntime(): void {
  startInputWorker();
  startOutputWorker();
}
