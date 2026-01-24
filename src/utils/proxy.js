/**
 * Evomi Proxy Configuration
 *
 * Handles residential proxy setup for YouTube transcript fetching
 * to bypass rate limiting.
 *
 * Uses undici ProxyAgent which works with Node.js native fetch.
 */

import { ProxyAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';
import logger from './logger.js';

const EVOMI_API_KEY = process.env.EVOMI_API_KEY;
const EVOMI_API_URL = 'https://api.evomi.com/public/generate';

// Cache proxy credentials to avoid repeated API calls
let cachedProxyUrl = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Store original dispatcher
let originalDispatcher = null;

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
 * Enable proxy for global fetch using undici dispatcher
 * Call this before making transcript requests
 */
export async function enableProxyForFetch() {
  const agent = await getProxyAgent();

  if (!agent) {
    logger.warn('Proxy not available, using direct connection');
    return false;
  }

  // Store original dispatcher
  originalDispatcher = getGlobalDispatcher();

  // Set proxy as global dispatcher
  setGlobalDispatcher(agent);

  logger.info('Proxy enabled for fetch requests');
  return true;
}

/**
 * Disable proxy and restore original dispatcher
 */
export function disableProxyForFetch() {
  if (originalDispatcher) {
    setGlobalDispatcher(originalDispatcher);
    originalDispatcher = null;
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
