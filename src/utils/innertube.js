/**
 * Shared Innertube utilities for youtubei.js
 * Used by video-details.js and transcript.js
 */

import { Innertube, Log } from 'youtubei.js';
import logger from './logger';

// Suppress youtubei.js parser warnings (they're non-fatal)
Log.setLevel(Log.Level.NONE);

// Singleton Innertube instance (reused across requests)
let innertubeInstance = null;

/**
 * Get or create a singleton Innertube instance
 * @returns {Promise<Innertube>}
 */
export async function getInnertube() {
  if (!innertubeInstance) {
    logger.info('Creating new Innertube instance');
    innertubeInstance = await Innertube.create({
      generate_session_locally: true,
    });
  }
  return innertubeInstance;
}

/**
 * Reset the Innertube instance (useful for testing or error recovery)
 */
export function resetInnertube() {
  innertubeInstance = null;
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

    throw new Error(`Could not resolve channel: ${identifier}`);
  } catch (error) {
    logger.warn(`Failed to resolve channel identifier: ${identifier}`, error.message);
    throw error;
  }
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
