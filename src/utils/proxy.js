/**
 * Evomi Proxy Configuration
 *
 * Handles residential proxy setup for YouTube transcript fetching
 * to bypass rate limiting.
 */

import { HttpsProxyAgent } from 'https-proxy-agent';
import logger from './logger.js';

const EVOMI_API_KEY = process.env.EVOMI_API_KEY;
const EVOMI_API_URL = 'https://api.evomi.com/public/generate';

// Cache proxy credentials to avoid repeated API calls
let cachedProxyUrl = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Generate proxy credentials from Evomi API
 */
async function generateProxyCredentials() {
  if (!EVOMI_API_KEY) {
    return null;
  }

  // Check cache
  if (cachedProxyUrl && (Date.now() - cacheTimestamp) < CACHE_TTL) {
    return cachedProxyUrl;
  }

  try {
    const params = new URLSearchParams({
      product: 'rpc', // Residential Proxies Core ($0.49/GB)
      countries: 'US',
      format: '1', // username:password@host:port
      protocol: 'http',
      amount: '1',
      apikey: EVOMI_API_KEY
    });

    const response = await fetch(`${EVOMI_API_URL}?${params}`);
    const data = await response.json();

    if (data.error) {
      logger.error('Evomi API error', data.error);
      return null;
    }

    // Response is the proxy URL string directly
    if (typeof data === 'string' || response.headers.get('content-type')?.includes('text/plain')) {
      const text = typeof data === 'string' ? data : await response.text();
      cachedProxyUrl = text.trim();
      cacheTimestamp = Date.now();
      logger.info('Evomi proxy credentials generated');
      return cachedProxyUrl;
    }

    // If response is JSON with the proxy URL
    const text = await response.text();
    cachedProxyUrl = text.trim();
    cacheTimestamp = Date.now();
    logger.info('Evomi proxy credentials generated');
    return cachedProxyUrl;
  } catch (error) {
    logger.error('Failed to generate proxy credentials', error.message);
    return null;
  }
}

/**
 * Get configured HttpsProxyAgent
 * Returns null if proxy is not configured or unavailable
 */
export async function getProxyAgent() {
  const proxyUrl = await generateProxyCredentials();

  if (!proxyUrl) {
    return null;
  }

  try {
    return new HttpsProxyAgent(proxyUrl);
  } catch (error) {
    logger.error('Failed to create proxy agent', error.message);
    return null;
  }
}

/**
 * Enable proxy for global fetch
 * Call this before making transcript requests
 */
export async function enableProxyForFetch() {
  const agent = await getProxyAgent();

  if (!agent) {
    logger.warn('Proxy not available, using direct connection');
    return false;
  }

  // Store original fetch
  const originalFetch = global.fetch;

  // Monkey-patch global fetch to use proxy
  global.fetch = (url, options = {}) => {
    return originalFetch(url, { ...options, agent });
  };

  // Store reference to restore later
  global._originalFetch = originalFetch;
  global._proxyEnabled = true;

  logger.info('Proxy enabled for fetch requests');
  return true;
}

/**
 * Disable proxy and restore original fetch
 */
export function disableProxyForFetch() {
  if (global._originalFetch) {
    global.fetch = global._originalFetch;
    delete global._originalFetch;
    delete global._proxyEnabled;
    logger.info('Proxy disabled, restored original fetch');
  }
}

/**
 * Check if proxy is configured
 */
export function isProxyConfigured() {
  return !!EVOMI_API_KEY;
}

/**
 * Execute a function with proxy enabled, then restore original fetch
 */
export async function withProxy(fn) {
  if (!isProxyConfigured()) {
    return fn();
  }

  const proxyEnabled = await enableProxyForFetch();

  try {
    return await fn();
  } finally {
    if (proxyEnabled) {
      disableProxyForFetch();
    }
  }
}

export default {
  getProxyAgent,
  enableProxyForFetch,
  disableProxyForFetch,
  isProxyConfigured,
  withProxy
};
