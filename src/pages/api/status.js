import cache from '@/utils/cache';
import { isRedisConnected } from '@/utils/redis-cache';
import { getProxyHealth, getDirectBlockStatus } from '@/utils/proxy';

const startTime = Date.now();

/**
 * Health & monitoring endpoint.
 * No auth required (read-only, no sensitive data).
 *
 * GET /api/status
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).end();
  }

  const proxyHealth = getProxyHealth();

  const response = {
    uptime: Math.floor((Date.now() - startTime) / 1000),
    cache: {
      l1: cache.getStats(),
      redis: { connected: isRedisConnected() },
    },
    proxy: {
      pool: proxyHealth,
      healthyCount: proxyHealth.filter(p => p.healthy).length,
      totalCount: proxyHealth.length,
      directIp: getDirectBlockStatus(),
    },
  };

  return res.status(200).json(response);
}
