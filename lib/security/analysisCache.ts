/**
 * In-memory LRU cache for website analysis results
 * Prevents repeated crawls of the same URL by the same user
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxSize: number;
  private ttlMs: number;
  private cleanupInterval: NodeJS.Timeout;

  constructor(maxSize: number = 100, ttlMs: number = 15 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;

    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Get a value from cache
   * Returns undefined if not found or expired
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.data;
  }

  /**
   * Set a value in cache
   */
  set(key: string, data: T, customTtlMs?: number): void {
    const ttl = customTtlMs || this.ttlMs;
    const entry: CacheEntry<T> = {
      data,
      expiresAt: Date.now() + ttl,
    };

    // If key exists, delete it first to maintain insertion order
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    this.cache.set(key, entry);

    // Evict oldest if over max size
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a specific key
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
    }

    if (expiredKeys.length > 0) {
      console.log(`[AnalysisCache] Cleaned up ${expiredKeys.length} expired entries`);
    }
  }

  /**
   * Get cache stats
   */
  getStats(): { size: number; maxSize: number; ttlMs: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlMs: this.ttlMs,
    };
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Cleanup on shutdown
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
  }
}

// Cache for website analysis results
const websiteAnalysisCache = new LRUCache<any>(100, 15 * 60 * 1000); // 15 minutes TTL

/**
 * Create a cache key for website analysis
 */
export function createWebsiteCacheKey(userId: string, url: string): string {
  // Normalize URL to avoid cache misses on minor differences
  try {
    const urlObj = new URL(url);
    const normalizedUrl = `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
    return `website:${userId}:${normalizedUrl}`;
  } catch {
    return `website:${userId}:${url}`;
  }
}

/**
 * Get cached website analysis result
 */
export function getCachedWebsiteAnalysis(userId: string, url: string): any | undefined {
  const key = createWebsiteCacheKey(userId, url);
  const cached = websiteAnalysisCache.get(key);

  if (cached) {
    console.log(`[AnalysisCache] Cache HIT for ${url}`);
  }

  return cached;
}

/**
 * Cache website analysis result
 */
export function cacheWebsiteAnalysis(userId: string, url: string, result: any): void {
  const key = createWebsiteCacheKey(userId, url);
  websiteAnalysisCache.set(key, result);
  console.log(`[AnalysisCache] Cached result for ${url}`);
}

/**
 * Clear cache for a specific user and URL
 */
export function clearWebsiteCache(userId: string, url: string): void {
  const key = createWebsiteCacheKey(userId, url);
  websiteAnalysisCache.delete(key);
}

/**
 * Get cache stats
 */
export function getAnalysisCacheStats(): { size: number; maxSize: number; ttlMs: number } {
  return websiteAnalysisCache.getStats();
}

export { websiteAnalysisCache };
