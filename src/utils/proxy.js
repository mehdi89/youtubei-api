/**
 * Proxy Pool - Server-to-server proxy for YouTube fetching
 *
 * Two levels of health tracking:
 *   1. Server health: proxy server unreachable → 3 failures → 60s cooldown
 *   2. YouTube blocks: YouTube blocked this proxy's IP → instant 5min cooldown
 *
 * Also tracks the gateway's own direct IP for YouTube blocks,
 * so endpoints can skip direct fetch and go straight to proxy.
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

// --- Server health: proxy unreachable (3 failures → 60s cooldown) ---
const health = new Map(); // url → { failures, unhealthyUntil }

// --- YouTube block tracking: IP blocked by YouTube (instant → 5min cooldown) ---
const ytBlocks = new Map(); // url → { blockedUntil }
const YT_BLOCK_COOLDOWN = 5 * 60_000; // 5 minutes

// --- Direct IP tracking: gateway's own IP blocked by YouTube ---
let directBlock = { blockedUntil: 0 };

// ---- Health checks ----

function isHealthy(url) {
  // Check server health
  const entry = health.get(url);
  if (entry?.unhealthyUntil && Date.now() < entry.unhealthyUntil) return false;
  if (entry?.unhealthyUntil && Date.now() >= entry.unhealthyUntil) {
    health.delete(url);
  }

  // Check YouTube blocks
  const block = ytBlocks.get(url);
  if (block && Date.now() < block.blockedUntil) return false;
  if (block && Date.now() >= block.blockedUntil) {
    ytBlocks.delete(url);
  }

  return true;
}

function recordSuccess(url) {
  health.delete(url);
  // Don't clear ytBlocks on success - let the cooldown expire naturally
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

function recordYouTubeBlock(url) {
  ytBlocks.set(url, { blockedUntil: Date.now() + YT_BLOCK_COOLDOWN });
  logger.warn('Proxy IP YouTube-blocked for 5min', url);
}

// ---- YouTube block detection ----

function isYouTubeBlock(data) {
  // HTTP-level blocks
  if (data.status === 429 || data.status === 403) return true;

  // Content-level blocks (consent page, bot detection)
  if (typeof data.body === 'string') {
    const body = data.body.toLowerCase();
    if (
      body.includes('consent.youtube.com') ||
      body.includes('sign in to confirm') ||
      body.includes('before you continue')
    ) {
      return true;
    }
  }

  return false;
}

// ---- Public API ----

/**
 * Check if proxy pool is configured
 */
export function isProxyConfigured() {
  return pool.length > 0;
}

/**
 * Check if the gateway's own direct IP is YouTube-blocked.
 * Endpoints should skip direct fetch and go straight to proxy when true.
 */
export function isDirectBlocked() {
  if (Date.now() >= directBlock.blockedUntil) return false;
  return true;
}

/**
 * Record that the gateway's direct IP got blocked by YouTube.
 * Called by endpoints when direct fetch returns 429/403.
 */
export function recordDirectBlock() {
  directBlock.blockedUntil = Date.now() + YT_BLOCK_COOLDOWN;
  logger.warn('Direct IP YouTube-blocked for 5min', `Cooldown until ${new Date(directBlock.blockedUntil).toLocaleTimeString()}`);
}

/**
 * Detect if a fetch response indicates a YouTube block.
 * Endpoints can use this to check direct fetch responses.
 */
export function isYouTubeBlockResponse(status, body) {
  if (status === 429 || status === 403) return true;
  if (typeof body === 'string') {
    const lower = body.toLowerCase();
    if (
      lower.includes('consent.youtube.com') ||
      lower.includes('sign in to confirm') ||
      lower.includes('before you continue')
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Fetch a URL through the proxy pool.
 * Tries each healthy server in round-robin order until one succeeds.
 * Returns { body, status, contentType, hops } where hops = number of servers tried.
 */
export async function proxyFetch(url, headers = {}) {
  const healthy = pool.filter(isHealthy);
  if (healthy.length === 0) {
    logger.error('Proxy pool exhausted', 'No healthy servers available | hops: 0');
    throw new Error('No healthy proxy servers available');
  }

  const startIdx = rrIndex;
  let lastError = null;

  for (let hop = 1; hop <= healthy.length; hop++) {
    const server = healthy[(startIdx + hop - 1) % healthy.length];
    rrIndex = (startIdx + hop) % healthy.length;

    logger.info('Using proxy server', `${server} | hop: ${hop}/${healthy.length}`);

    try {
      const result = await fetchFromServer(server, url, headers);
      recordSuccess(server);
      logger.success('Proxy fetch succeeded', `${server} | hop: ${hop}/${healthy.length}`);
      return { ...result, hops: hop };
    } catch (error) {
      if (error.isYouTubeBlock) {
        recordYouTubeBlock(server);
        logger.warn('YouTube blocked proxy IP', `${server} | hop: ${hop}/${healthy.length} | status: ${error.ytStatus}`);
      } else {
        recordFailure(server);
        logger.warn('Proxy hop failed', `${server} | hop: ${hop}/${healthy.length} | ${error.message}`);
      }
      lastError = error;
    }
  }

  logger.error('Proxy pool exhausted', `All ${healthy.length} servers failed | url: ${url.substring(0, 80)}`);
  throw lastError;
}

async function fetchFromServer(server, url, headers) {
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

  // Detect YouTube blocks from the proxied response
  if (isYouTubeBlock(data)) {
    const err = new Error(`YouTube blocked proxy IP (status: ${data.status})`);
    err.isYouTubeBlock = true;
    err.ytStatus = data.status;
    throw err;
  }

  if (!data.body && data.status !== 200) {
    throw new Error(`Proxied request failed with status ${data.status}`);
  }

  return { body: data.body, status: data.status, contentType: data.contentType };
}

/**
 * Legacy wrapper for backward compatibility.
 */
export async function withProxy(fn) {
  return fn();
}

/**
 * Return health info for each proxy in the pool (for /api/status).
 */
export function getProxyHealth() {
  return pool.map(url => {
    const block = ytBlocks.get(url);
    const entry = health.get(url);
    return {
      url,
      healthy: isHealthy(url),
      failures: entry?.failures || 0,
      unhealthyUntil: entry?.unhealthyUntil || 0,
      ytBlocked: block ? Date.now() < block.blockedUntil : false,
      ytBlockedUntil: block?.blockedUntil || 0,
    };
  });
}

/**
 * Return direct IP block status (for /api/status).
 */
export function getDirectBlockStatus() {
  return {
    blocked: isDirectBlocked(),
    blockedUntil: directBlock.blockedUntil,
  };
}

export default {
  isProxyConfigured,
  proxyFetch,
  withProxy,
  getProxyHealth,
  getDirectBlockStatus,
  isDirectBlocked,
  recordDirectBlock,
  isYouTubeBlockResponse
};
