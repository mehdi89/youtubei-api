/**
 * Proxy Pool - Server-to-server proxy for YouTube fetching
 *
 * When a direct YouTube fetch fails (rate limited), picks another server
 * from the pool to proxy the request through.
 *
 * Env vars:
 *   PROXY_SERVERS - comma-separated list of proxy endpoints
 *   SERVER_IP     - this server's own IP (to skip self in pool)
 *   PROXY_SECRET  - shared secret for auth between servers
 */

import logger from './logger.js';

const PROXY_SERVERS = (process.env.PROXY_SERVERS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const SERVER_IP = process.env.SERVER_IP || '';
const PROXY_SECRET = process.env.PROXY_SECRET || '';
const API_KEY = process.env.YOUTUBE_API_KEY || '';

// Filter out self from pool
const pool = PROXY_SERVERS.filter(url => !url.includes(SERVER_IP));

// Round-robin index
let rrIndex = 0;

// Health tracking: 3 consecutive failures → unhealthy for 60s
const health = new Map(); // url → { failures: number, unhealthyUntil: number }

function isHealthy(url) {
  const entry = health.get(url);
  if (!entry) return true;
  if (entry.unhealthyUntil && Date.now() < entry.unhealthyUntil) return false;
  if (entry.unhealthyUntil && Date.now() >= entry.unhealthyUntil) {
    // Reset after cooldown
    health.delete(url);
    return true;
  }
  return true;
}

function recordSuccess(url) {
  health.delete(url);
}

function recordFailure(url) {
  const entry = health.get(url) || { failures: 0, unhealthyUntil: 0 };
  entry.failures += 1;
  if (entry.failures >= 3) {
    entry.unhealthyUntil = Date.now() + 60_000;
    logger.warn('Proxy server marked unhealthy for 60s', url);
  }
  health.set(url, entry);
}

function pickServer() {
  const healthy = pool.filter(isHealthy);
  if (healthy.length === 0) return null;
  const server = healthy[rrIndex % healthy.length];
  rrIndex = (rrIndex + 1) % healthy.length;
  return server;
}

/**
 * Check if proxy pool is configured
 */
export function isProxyConfigured() {
  return pool.length > 0;
}

/**
 * Fetch a URL through the proxy pool.
 * Returns the response body as text, or throws on failure.
 */
export async function proxyFetch(url, headers = {}) {
  const server = pickServer();
  if (!server) {
    throw new Error('No healthy proxy servers available');
  }

  logger.info('Using proxy server', server);

  try {
    // Determine auth: yt-api servers use api-key header, extra servers use secret in body
    const isYtApi = server.includes('/api/proxy-fetch');

    const requestBody = isYtApi
      ? { url, headers }
      : { url, headers, secret: PROXY_SECRET };

    const requestHeaders = { 'Content-Type': 'application/json' };
    if (isYtApi) {
      requestHeaders['api-key'] = API_KEY;
    }

    const response = await fetch(server, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(15_000)
    });

    if (!response.ok) {
      throw new Error(`Proxy returned ${response.status}`);
    }

    const data = await response.json();

    if (!data.body && data.status !== 200) {
      throw new Error(`Proxied request failed with status ${data.status}`);
    }

    recordSuccess(server);
    return { body: data.body, status: data.status, contentType: data.contentType };
  } catch (error) {
    recordFailure(server);
    logger.warn('Proxy fetch failed', `${server} | ${error.message}`);
    throw error;
  }
}

/**
 * Legacy wrapper for backward compatibility.
 * Falls back to proxy pool when direct fetch fails.
 * The function `fn` is called with no arguments (direct fetch).
 */
export async function withProxy(fn) {
  return fn();
}

export default {
  isProxyConfigured,
  proxyFetch,
  withProxy
};
