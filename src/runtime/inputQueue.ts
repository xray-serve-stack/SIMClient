// src/runtime/inputQueue.ts

import { AsyncQueue } from "./queues";
import type { Result } from "./results";

/**
 * InputQueue — owned and consumed exclusively by InputWorker.
 *
 * The producer is OutputWorker, which enqueues typed Results.
 */
class InputQueue {
  private readonly queue = new AsyncQueue<Result>();

  enqueue(result: Result): void {
    this.queue.enqueue(result);
  }

  /** @internal — InputWorker only. */
  take(): Promise<Result> {
    return this.queue.take();
  }
}

export const inputQueue = new InputQueue();
