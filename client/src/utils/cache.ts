/**
 * Simple in-memory cache for API responses
 * Reduces redundant network requests and improves perceived performance
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class ApiCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private pendingRequests = new Map<string, Promise<unknown>>();

  /**
   * Get cached data if not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) return null;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Store data in cache with TTL
   */
  set<T>(key: string, data: T, ttlMs: number = 30000): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttlMs,
    });
  }

  /**
   * Invalidate a specific cache key
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all cache entries matching a pattern
   */
  invalidatePattern(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear();
    this.pendingRequests.clear();
  }

  /**
   * Deduplicate concurrent requests for the same key
   * If a request is already in flight, return its promise instead of making a new request
   */
  async dedupe<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    // Check if request is already in flight
    const pending = this.pendingRequests.get(key) as Promise<T> | undefined;
    if (pending) {
      return pending;
    }

    // Create and store the promise
    const promise = fetcher().finally(() => {
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  /**
   * Get cached data or fetch if not available/expired
   * Also deduplicates concurrent requests
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number = 30000
  ): Promise<T> {
    // Check cache first
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Deduplicate and fetch
    const data = await this.dedupe(key, fetcher);
    this.set(key, data, ttlMs);
    return data;
  }

  /**
   * Stale-while-revalidate pattern
   * Returns cached data immediately (if available) while fetching fresh data in background
   */
  async swr<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: {
      ttlMs?: number;
      staleMs?: number;
      onRevalidate?: (data: T) => void;
    } = {}
  ): Promise<T> {
    const { ttlMs = 30000, staleMs = 60000, onRevalidate } = options;
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    const now = Date.now();

    // If we have cached data
    if (entry) {
      const isStale = now > entry.expiresAt;
      const isTooOld = now > entry.timestamp + staleMs;

      // If data is stale but not too old, return it and revalidate in background
      if (isStale && !isTooOld) {
        this.dedupe(key, async () => {
          const freshData = await fetcher();
          this.set(key, freshData, ttlMs);
          onRevalidate?.(freshData);
          return freshData;
        });
        return entry.data;
      }

      // If data is fresh, just return it
      if (!isStale) {
        return entry.data;
      }
    }

    // No cache or too old - fetch fresh
    return this.getOrFetch(key, fetcher, ttlMs);
  }
}

// Singleton instance
export const apiCache = new ApiCache();

// Cache TTL constants (in milliseconds)
export const CACHE_TTL = {
  SHORT: 15 * 1000, // 15 seconds - for frequently changing data
  MEDIUM: 60 * 1000, // 1 minute - for moderately changing data
  LONG: 5 * 60 * 1000, // 5 minutes - for rarely changing data
  STATS: 30 * 1000, // 30 seconds - platform stats
  MARKETS: 30 * 1000, // 30 seconds - market list
  MARKET_DETAIL: 15 * 1000, // 15 seconds - individual market
  CATEGORIES: 5 * 60 * 1000, // 5 minutes - categories rarely change
} as const;
