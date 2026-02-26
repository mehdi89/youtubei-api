/**
 * Evomi Proxy Configuration
 *
 * Handles residential proxy setup for YouTube transcript fetching
 * to bypass rate limiting.
 *
 * Uses undici ProxyAgent which works with Node.js native fetch.
 */

import { ProxyAgent } from 'undici';
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

    // Evomi API returns plain text in format: username:password@host:port
    const text = await response.text();

    if (!response.ok) {
      logger.error('Evomi API error', `Status: ${response.status}, Body: ${text}`);
      return null;
    }

    // Check if response looks like an error message
    if (text.includes('error') || text.includes('Error')) {
      logger.error('Evomi API error', text);
      return null;
    }

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
 * Get configured ProxyAgent for undici/fetch
 * Returns null if proxy is not configured or unavailable
 */
export async function getProxyAgent() {
  const proxyUrl = await generateProxyCredentials();

  if (!proxyUrl) {
    return null;
  }

  try {
    // Format: username:password@host:port -> http://username:password@host:port
    const fullProxyUrl = proxyUrl.startsWith('http') ? proxyUrl : `http://${proxyUrl}`;
    return new ProxyAgent(fullProxyUrl);
  } catch (error) {
    logger.error('Failed to create proxy agent', error.message);
    return null;
  }
}

/**
 * Check if proxy is configured
 */
export function isProxyConfigured() {
  return !!EVOMI_API_KEY;
}

/**
 * Execute a function with proxy dispatcher passed as argument.
 * The function receives the proxy dispatcher (or undefined) which should
 * be passed as the `dispatcher` option to fetch() calls.
 * This avoids modifying the global dispatcher which causes race conditions
 * with concurrent requests.
 */
export async function withProxy(fn) {
  if (!isProxyConfigured()) {
    return fn();
  }

  const agent = await getProxyAgent();
  if (!agent) {
    logger.warn('Proxy not available, using direct connection');
    return fn();
  }

  logger.info('Using proxy dispatcher for fetch request');
  return fn(agent);
}

export default {
  getProxyAgent,
  isProxyConfigured,
  withProxy
};
