// src/runtime/commandQueue.ts

import { AsyncQueue } from "./queues";
import type { Command } from "./commands";

/**
 * CommandQueue — owned and consumed exclusively by OutputWorker.
 *
 * External code may only enqueue. It must never take, inspect, or clear.
 */
class CommandQueue {
  private readonly queue = new AsyncQueue<Command>();

  enqueue(command: Command): void {
    this.queue.enqueue(command);
  }

  /** @internal — OutputWorker only. */
  take(): Promise<Command> {
    return this.queue.take();
  }
}

export const commandQueue = new CommandQueue();

/**
 * The only public API for submitting work to the pipeline.
 * Returns immediately; the caller never awaits the DB operation.
 */
export function enqueueCommand(command: Command): void {
  commandQueue.enqueue(command);
}
