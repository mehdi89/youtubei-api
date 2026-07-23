/**
 * L1 + L2 Cache Wrapper
 *
 * L1 = in-memory (cache.js, sync, instant)
 * L2 = Redis (async, ~2ms on localhost)
 *
 * If REDIS_URL is not set, behaves exactly like the old L1-only cache.
 * If Redis goes down, falls back to L1 silently.
 */

import Redis from 'ioredis';
import cache from './cache.js';
import logger from './logger.js';

const REDIS_URL = process.env.REDIS_URL || '';
let redis = null;

if (REDIS_URL) {
  redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => {
      if (times > 5) return null; // stop retrying
      return Math.min(times * 200, 2000);
    },
    lazyConnect: true,
  });
  redis.on('error', (err) => logger.warn('Redis error', err.message));
  redis.connect().catch(() => {});
}

/**
 * Get a value from cache. Checks L1 (in-memory) first, then L2 (Redis).
 * On L2 hit, warms L1 with remaining TTL.
 */
export async function cacheGet(key) {
  // L1: sync, instant
  const l1 = cache.get(key);
  if (l1 !== null) return l1;

  // L2: async
  if (!redis) return null;
  try {
    const val = await redis.get(key);
    if (!val) return null;

    const parsed = JSON.parse(val);
    // Warm L1 with remaining TTL from Redis
    const ttl = await redis.ttl(key);
    if (ttl > 0) {
      cache.set(key, parsed, ttl);
    }
    return parsed;
  } catch {
    return null; // Redis down, L1 miss = cache miss
  }
}

/**
 * Set a value in both L1 and L2 cache.
 */
export async function cacheSet(key, value, ttlSeconds) {
  // Always write L1
  cache.set(key, value, ttlSeconds);

  // Write L2 if available
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // L1 is set, ignore L2 failure
  }
}

/**
 * Check if Redis is connected (for /api/status).
 */
export function isRedisConnected() {
  return redis?.status === 'ready';
}
