/**
 * In-memory rate limiter for API endpoints
 * Tracks requests per user per endpoint with sliding window
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if a request is allowed for a given key
   * @param key - Unique identifier (e.g., "user:123:endpoint:/api/autofill")
   * @param config - Rate limit configuration
   * @returns { allowed: boolean, remaining: number, resetAt: number }
   */
  check(
    key: string,
    config: RateLimitConfig
  ): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const entry = this.limits.get(key);

    // No previous requests or window expired
    if (!entry || now - entry.windowStart >= config.windowMs) {
      this.limits.set(key, {
        count: 1,
        windowStart: now,
      });

      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetAt: now + config.windowMs,
      };
    }

    // Within the window
    const resetAt = entry.windowStart + config.windowMs;

    if (entry.count >= config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt,
      };
    }

    // Increment count
    entry.count += 1;
    this.limits.set(key, entry);

    return {
      allowed: true,
      remaining: config.maxRequests - entry.count,
      resetAt,
    };
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.limits.entries()) {
      // Remove entries older than 1 hour
      if (now - entry.windowStart > 3600000) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.limits.delete(key);
    }

    if (expiredKeys.length > 0) {
      console.log(`[RateLimiter] Cleaned up ${expiredKeys.length} expired entries`);
    }
  }

  /**
   * Reset rate limit for a specific key
   */
  reset(key: string): void {
    this.limits.delete(key);
  }

  /**
   * Get current stats for monitoring
   */
  getStats(): { totalKeys: number; memoryUsage: number } {
    return {
      totalKeys: this.limits.size,
      memoryUsage: process.memoryUsage().heapUsed,
    };
  }

  /**
   * Cleanup on shutdown
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.limits.clear();
  }
}

// Singleton instance
const rateLimiter = new RateLimiter();

// Default configurations for different endpoints
export const RATE_LIMIT_CONFIGS = {
  WEBSITE_AUTOFILL: {
    maxRequests: 5,
    windowMs: 10 * 60 * 1000, // 10 minutes
  },
  FILE_AUTOFILL: {
    maxRequests: 5,
    windowMs: 10 * 60 * 1000, // 10 minutes
  },
  FILE_UPLOAD: {
    maxRequests: 10,
    windowMs: 10 * 60 * 1000, // 10 minutes
  },
} as const;

/**
 * Helper function to create a rate limit key
 */
export function createRateLimitKey(userId: string, endpoint: string): string {
  return `ratelimit:${userId}:${endpoint}`;
}

/**
 * Check rate limit for a user and endpoint
 */
export function checkRateLimit(
  userId: string,
  endpoint: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetAt: number } {
  const key = createRateLimitKey(userId, endpoint);
  return rateLimiter.check(key, config);
}

/**
 * Reset rate limit for a user and endpoint (admin use)
 */
export function resetRateLimit(userId: string, endpoint: string): void {
  const key = createRateLimitKey(userId, endpoint);
  rateLimiter.reset(key);
}

/**
 * Get rate limiter stats
 */
export function getRateLimiterStats(): { totalKeys: number; memoryUsage: number } {
  return rateLimiter.getStats();
}

export { rateLimiter };
