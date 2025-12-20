import { Request, Response, NextFunction } from "express";

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  max: number; // Max requests per window
  message?: string;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
}

const stores: Map<string, RateLimitStore> = new Map();

/**
 * Create a rate limiter middleware
 */
export const createRateLimiter = (options: RateLimitOptions) => {
  const {
    windowMs,
    max,
    message = "Too many requests, please try again later",
    keyGenerator = (req) => req.ip || "unknown",
    skip = () => false,
  } = options;

  const storeName = `${windowMs}-${max}`;
  if (!stores.has(storeName)) {
    stores.set(storeName, {});
  }
  const store = stores.get(storeName)!;

  // Cleanup old entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const key in store) {
      if (store[key].resetTime < now) {
        delete store[key];
      }
    }
  }, windowMs);

  return (req: Request, res: Response, next: NextFunction) => {
    if (skip(req)) {
      return next();
    }

    const key = keyGenerator(req);
    const now = Date.now();

    if (!store[key] || store[key].resetTime < now) {
      store[key] = {
        count: 1,
        resetTime: now + windowMs,
      };
    } else {
      store[key].count++;
    }

    const remaining = Math.max(0, max - store[key].count);
    const resetTime = store[key].resetTime;

    res.set({
      "X-RateLimit-Limit": max.toString(),
      "X-RateLimit-Remaining": remaining.toString(),
      "X-RateLimit-Reset": Math.ceil(resetTime / 1000).toString(),
    });

    if (store[key].count > max) {
      res.set("Retry-After", Math.ceil((resetTime - now) / 1000).toString());
      console.log("Too Many Requests", message);
      return res.status(429).json({
        error: "Too Many Requests",
        message,
        retryAfter: Math.ceil((resetTime - now) / 1000),
      });
    }

    next();
  };
};

// Pre-configured rate limiters
export const generalLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 12000, // 100 requests per 1 minute
  message: "Too many requests from this IP, please try again after 1 minute",
});

export const authLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100000, // 10 login attempts per hour
  message: "Too many authentication attempts, please try again after an hour",
});

export const strictLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: "Rate limit exceeded, please slow down",
});

export const tradeLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 2000, // 20 trades per minute
  message: "Trading rate limit exceeded, please wait before making more trades",
});

export const commentLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 comments per minute
  message:
    "Comment rate limit exceeded, please wait before posting more comments",
});

export const claimLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 claims per minute
  message: "Claim rate limit exceeded, please wait before making more claims",
});

export const withdrawalLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 withdrawals per hour
  message: "Withdrawal rate limit exceeded, please try again later",
});

export const marketCreationLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1000, // 10 markets per hour
  message: "Market creation rate limit exceeded, please try again later",
});

export const voteLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 votes per minute
  message: "Vote rate limit exceeded, please slow down",
});
