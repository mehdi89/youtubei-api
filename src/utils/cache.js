/**
 * Simple in-memory cache with TTL support
 * For production, consider upgrading to Redis
 */

class Cache {
  constructor() {
    this.store = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0
    };

    // Clean up expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Generate a cache key from type and params
   */
  generateKey(type, params) {
    const sortedParams = Object.keys(params)
      .sort()
      .map(k => `${k}:${params[k]}`)
      .join('|');
    return `${type}:${sortedParams}`;
  }

  /**
   * Get a value from cache
   * @returns {any|null} Cached value or null if not found/expired
   */
  get(key) {
    const entry = this.store.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.value;
  }

  /**
   * Set a value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttlSeconds - Time to live in seconds
   */
  set(key, value, ttlSeconds) {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttlSeconds * 1000),
      createdAt: Date.now()
    });
    this.stats.sets++;
  }

  /**
   * Delete a specific key
   */
  delete(key) {
    return this.store.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.store.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      ...this.stats,
      size: this.store.size,
      hitRate: this.stats.hits + this.stats.misses > 0
        ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[Cache] Cleaned ${cleaned} expired entries`);
    }
  }
}

// Singleton instance
const cache = new Cache();

// Default TTLs in seconds
export const TTL = {
  VIDEO_DETAILS: 60 * 60,      // 1 hour
  TRANSCRIPT: 60 * 60 * 24,    // 24 hours (transcripts rarely change)
  SEARCH: 60 * 5,              // 5 minutes (search results change)
  CHANNEL_DETAILS: 60 * 60,    // 1 hour
  CHANNEL_VIDEOS: 60 * 15,     // 15 minutes
  CHANNEL_LIVE: 60 * 2,        // 2 minutes (live content changes frequently)
  PLAYLIST: 60 * 15,           // 15 minutes
};

export default cache;
