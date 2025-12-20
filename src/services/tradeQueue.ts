import { UUID } from "crypto";

/**
 * Trade queue to serialize operations per market/option to prevent deadlocks
 * This ensures that operations on the same market/option are processed sequentially
 */

interface QueuedOperation<T = any> {
  id: string;
  marketId: UUID;
  optionId?: UUID;
  operation: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
  timeout: NodeJS.Timeout;
}

class TradeQueue {
  private queues: Map<string, QueuedOperation[]> = new Map();
  private processing: Set<string> = new Set();

  /**
   * Generate a queue key for market/option combination
   */
  private getQueueKey(marketId: UUID, optionId?: UUID): string {
    return optionId ? `${marketId}:${optionId}` : marketId;
  }

  /**
   * Add an operation to the queue for a specific market/option
   */
  async enqueue<T>(
    marketId: UUID,
    optionId: UUID | undefined,
    operation: () => Promise<T>,
    timeoutMs: number = 30000
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const queueKey = this.getQueueKey(marketId, optionId);
      const operationId = `${queueKey}:${Date.now()}:${Math.random()}`;

      const queuedOp: QueuedOperation<T> = {
        id: operationId,
        marketId,
        optionId,
        operation,
        resolve,
        reject,
        timeout: setTimeout(() => {
          this.removeFromQueue(queueKey, operationId);
          reject(new Error(`Trade operation timed out after ${timeoutMs}ms`));
        }, timeoutMs),
      };

      // Add to queue
      const queue = this.queues.get(queueKey) || [];
      queue.push(queuedOp);
      this.queues.set(queueKey, queue);

      // Process queue if not already processing
      this.processQueue(queueKey);
    });
  }

  /**
   * Process the next operation in the queue for a given key
   */
  private async processQueue(queueKey: string) {
    if (this.processing.has(queueKey)) {
      return; // Already processing
    }

    const queue = this.queues.get(queueKey);
    if (!queue || queue.length === 0) {
      return; // Nothing to process
    }

    this.processing.add(queueKey);

    try {
      while (queue.length > 0) {
        const operation = queue.shift()!;
        clearTimeout(operation.timeout);

        try {
          const result = await operation.operation();
          operation.resolve(result);
        } catch (error) {
          operation.reject(error);
        }
      }
    } finally {
      this.processing.delete(queueKey);
      // Clean up empty queue
      if (queue.length === 0) {
        this.queues.delete(queueKey);
      }
    }
  }

  /**
   * Remove a timed-out operation from the queue
   */
  private removeFromQueue(queueKey: string, operationId: string) {
    const queue = this.queues.get(queueKey);
    if (queue) {
      const index = queue.findIndex((op) => op.id === operationId);
      if (index >= 0) {
        const removed = queue.splice(index, 1)[0];
        clearTimeout(removed.timeout);
      }
      if (queue.length === 0) {
        this.queues.delete(queueKey);
      }
    }
  }

  /**
   * Get queue status for monitoring/debugging
   */
  getQueueStatus() {
    const status: Record<
      string,
      { queueLength: number; isProcessing: boolean }
    > = {};

    for (const [key, queue] of this.queues.entries()) {
      status[key] = {
        queueLength: queue.length,
        isProcessing: this.processing.has(key),
      };
    }

    return status;
  }

  /**
   * Clear all queues (for testing/shutdown)
   */
  clear() {
    for (const queue of this.queues.values()) {
      for (const op of queue) {
        clearTimeout(op.timeout);
        op.reject(new Error("Trade queue cleared"));
      }
    }
    this.queues.clear();
    this.processing.clear();
  }
}

// Export singleton instance
export const tradeQueue = new TradeQueue();

// Helper function to wrap trading operations
export async function withTradeQueue<T>(
  marketId: UUID,
  optionId: UUID | undefined,
  operation: () => Promise<T>,
  timeoutMs?: number
): Promise<T> {
  return tradeQueue.enqueue(marketId, optionId, operation, timeoutMs);
}
