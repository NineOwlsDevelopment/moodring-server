"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tradeQueue = void 0;
exports.withTradeQueue = withTradeQueue;
class TradeQueue {
    constructor() {
        this.queues = new Map();
        this.processing = new Set();
    }
    /**
     * Generate a queue key for market/option combination
     */
    getQueueKey(marketId, optionId) {
        return optionId ? `${marketId}:${optionId}` : marketId;
    }
    /**
     * Add an operation to the queue for a specific market/option
     */
    async enqueue(marketId, optionId, operation, timeoutMs = 30000) {
        return new Promise((resolve, reject) => {
            const queueKey = this.getQueueKey(marketId, optionId);
            const operationId = `${queueKey}:${Date.now()}:${Math.random()}`;
            const queuedOp = {
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
    async processQueue(queueKey) {
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
                const operation = queue.shift();
                clearTimeout(operation.timeout);
                try {
                    const result = await operation.operation();
                    operation.resolve(result);
                }
                catch (error) {
                    operation.reject(error);
                }
            }
        }
        finally {
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
    removeFromQueue(queueKey, operationId) {
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
        const status = {};
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
exports.tradeQueue = new TradeQueue();
// Helper function to wrap trading operations
async function withTradeQueue(marketId, optionId, operation, timeoutMs) {
    return exports.tradeQueue.enqueue(marketId, optionId, operation, timeoutMs);
}
//# sourceMappingURL=tradeQueue.js.map