/**
 * Shared Innertube utilities for youtubei.js
 * Used by video-details.js and transcript.js
 */

import { Innertube, Log } from 'youtubei.js';
import logger from './logger';

// Suppress youtubei.js parser warnings (they're non-fatal)
Log.setLevel(Log.Level.NONE);

// Pool of Innertube instances (round-robin to avoid blocking during refresh)
const POOL_SIZE = 3;
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

const pool = Array.from({ length: POOL_SIZE }, () => ({
  instance: null,
  createdAt: 0,
  refreshing: null, // Promise while refreshing, null otherwise
}));
let rrIndex = 0;

/**
 * Refresh a single pool slot, returning the new instance.
 * Concurrent callers on the same slot share the same promise.
 */
async function refreshSlot(slot) {
  if (slot.refreshing) return slot.refreshing;
  slot.refreshing = (async () => {
    try {
      logger.info(`Creating new Innertube instance (slot ${pool.indexOf(slot)})`);
      const instance = await Innertube.create({ generate_session_locally: true });
      slot.instance = instance;
      slot.createdAt = Date.now();
      return instance;
    } catch (err) {
      logger.error(`Failed to refresh Innertube slot ${pool.indexOf(slot)}: ${err.message}`);
      throw err;
    } finally {
      slot.refreshing = null;
    }
  })();
  return slot.refreshing;
}

/**
 * Get an Innertube instance from the pool using round-robin.
 * If the selected slot is stale or refreshing, try the next slot.
 * @returns {Promise<Innertube>}
 */
export async function getInnertube() {
  const now = Date.now();
  const startIdx = rrIndex;

  for (let i = 0; i < POOL_SIZE; i++) {
    const idx = (startIdx + i) % POOL_SIZE;
    const slot = pool[idx];

    // If this slot has a valid, non-stale instance, use it
    if (slot.instance && (now - slot.createdAt) <= SESSION_TTL_MS) {
      rrIndex = (idx + 1) % POOL_SIZE;
      return slot.instance;
    }

    // If stale but not currently refreshing, trigger background refresh and try next slot
    if (!slot.refreshing && slot.instance) {
      refreshSlot(slot).catch(() => {}); // fire-and-forget, error already logged in refreshSlot
    }
  }

  // All slots are stale or empty — must wait for one
  const slot = pool[startIdx % POOL_SIZE];
  rrIndex = (startIdx + 1) % POOL_SIZE;
  return refreshSlot(slot);
}

/**
 * Reset all Innertube instances (useful for testing or error recovery)
 */
export function resetInnertube() {
  for (const slot of pool) {
    slot.instance = null;
    slot.createdAt = 0;
    slot.refreshing = null;
  }
}

/**
 * YouTube now returns channel/playlist listing items as `LockupView` nodes instead of
 * the old `Video`/`PlaylistVideo` nodes. Reshape a LockupView into the legacy field
 * layout so the existing formatters keep working. Non-LockupView items pass through.
 * @param {object} item
 * @returns {object}
 */
export function normalizeLockup(item) {
  if (item?.type !== 'LockupView') return item;

  const parts = (item.metadata?.metadata?.metadata_rows || [])
    .flatMap(row => (row.metadata_parts || []).map(part => part.text?.text))
    .filter(Boolean);

  const badges = (item.content_image?.overlays || []).flatMap(overlay => overlay.badges || []);
  const durationBadge = badges.find(badge => /^\d{1,3}(:\d{2})+$/.test(badge.text || ''));
  const isLive = badges.some(badge => /live/i.test(badge.text || '') || /LIVE/.test(badge.badge_style || ''));

  // "789K views" / "14K watching" (live) / "1 waiting" (upcoming)
  const viewCount = parts.find(part => /\d.*(views?|watching|waiting)$/i.test(part));
  // "3 weeks ago" / "Streamed 2 years ago" / "Scheduled for 7/24/26, 3:00 AM"
  const published = parts.find(part => /ago$/i.test(part) || /^(scheduled|premieres)/i.test(part));
  // Playlist lockups carry the channel name as its own row; channel lockups don't.
  const author = parts.find(part => part !== viewCount && part !== published);

  return {
    id: item.content_id || null,
    title: { text: item.metadata?.title?.text || null },
    duration: durationBadge?.text || null,
    view_count: viewCount || null,
    published: { text: published || null },
    is_live: isLive,
    author: author ? { name: author, id: null } : null,
  };
}

/**
 * Decode HTML entities in a string
 * @param {string} encodedString - String with HTML entities
 * @returns {string} - Decoded string
 */
export function decodeEntities(encodedString) {
  if (!encodedString) return '';
  
  const translate_re = /&(nbsp|amp|quot|lt|gt);/g;
  const translate = {
    nbsp: ' ',
    amp: '&',
    quot: '"',
    lt: '<',
    gt: '>',
  };
  
  return encodedString
    .replace(translate_re, (match, entity) => translate[entity])
    .replace(/&#(\d+);/gi, (match, numStr) => {
      const num = parseInt(numStr, 10);
      return String.fromCharCode(num);
    });
}

/**
 * High-confidence languages for transcript extraction
 * These languages have reliable auto-generated captions
 */
export const HIGH_CONFIDENCE_LANGUAGES = [
  'en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'sv', 'da', 'fi', 'no'
];

/**
 * Resolve a channel identifier (handle, URL, or ID) to a proper channel ID
 * @param {Innertube} yt - Innertube instance
 * @param {string} identifier - Channel handle (@username), custom URL, or channel ID
 * @returns {Promise<string>} - Resolved channel ID (UC...)
 */
export async function resolveChannelId(yt, identifier) {
  if (!identifier) {
    throw new Error('Channel identifier is required');
  }

  // Already a channel ID (starts with UC and is 24 chars)
  if (identifier.startsWith('UC') && identifier.length === 24) {
    return identifier;
  }

  // Build URL to resolve
  let urlToResolve;
  if (identifier.startsWith('@')) {
    // Handle format: @username
    urlToResolve = `https://www.youtube.com/${identifier}`;
  } else if (identifier.startsWith('http')) {
    // Already a URL
    urlToResolve = identifier;
  } else {
    // Assume it's a custom URL or username
    urlToResolve = `https://www.youtube.com/@${identifier}`;
  }

  try {
    const resolved = await yt.resolveURL(urlToResolve);

    if (resolved?.payload?.browseId) {
      return resolved.payload.browseId;
    }

    // Fallback: try without @ prefix
    if (identifier.startsWith('@')) {
      const altUrl = `https://www.youtube.com/c/${identifier.slice(1)}`;
      const altResolved = await yt.resolveURL(altUrl);
      if (altResolved?.payload?.browseId) {
        return altResolved.payload.browseId;
      }
    }

    const notFound = new Error(`Could not resolve channel: ${identifier}`);
    notFound.code = 'CHANNEL_NOT_FOUND';
    throw notFound;
  } catch (error) {
    logger.warn(`Failed to resolve channel identifier: ${identifier}`, error.message);
    throw error;
  }
}

/**
 * Determine whether a channel resolution / fetch error means the channel does
 * not exist, as opposed to a transient or server-side failure. Channel
 * endpoints use this to return 404 (so callers skip dead channels) instead of
 * 500 (which triggers indefinite retries).
 * @param {Error} error
 * @returns {boolean}
 */
export function isChannelNotFoundError(error) {
  if (!error) return false;
  if (error.code === 'CHANNEL_NOT_FOUND') return true;
  const msg = (error.message || '').toLowerCase();
  return (
    msg.includes('could not resolve channel') ||
    msg.includes('status code 404') ||
    msg.includes('does not exist') ||
    msg.includes('not found')
  );
}

/**
 * Select the best language from available options
 * @param {string[]} availableLangs - Array of available language codes
 * @returns {string|null} - Selected language code or null
 */
export function selectBestLanguage(availableLangs) {
  if (!availableLangs || availableLangs.length === 0) {
    return null;
  }
  
  // 1. Prefer English
  if (availableLangs.includes('en')) {
    return 'en';
  }
  
  // 2. Try high-confidence languages
  const found = HIGH_CONFIDENCE_LANGUAGES.find(code => availableLangs.includes(code));
  if (found) {
    return found;
  }
  
  // 3. Fallback to first available
  return availableLangs[0];
}
