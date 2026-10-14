// src/runtime/queues.ts

/**
 * A minimal async FIFO queue.
 *
 * `take()` returns a promise that resolves with the next item as soon as one
 * is available. When the queue is empty, `take()` suspends on a promise and
 * consumes zero CPU — there is no polling, no timers, no busy waiting.
 *
 * `enqueue()` is safe to call from any number of concurrent callers: the
 * pending-taker list is drained synchronously and atomically within a single
 * microtask boundary.
 *
 * This is the same-thread equivalent of a blocking queue. It is intentionally
 * the only place where "blocking" semantics live, so that a future transport
 * step can replace it with a real cross-thread channel without touching
 * OutputWorker / InputWorker logic.
 */
export class AsyncQueue<T> {
  private items: T[] = [];
  private pendingTakers: Array<(item: T) => void> = [];

  enqueue(item: T): void {
    const taker = this.pendingTakers.shift();
    if (taker) {
      taker(item);
      return;
    }
    this.items.push(item);
  }

  take(): Promise<T> {
    if (this.items.length > 0) {
      return Promise.resolve(this.items.shift() as T);
    }
    return new Promise<T>((resolve) => {
      this.pendingTakers.push(resolve);
    });
  }

  get size(): number {
    return this.items.length;
  }
}
