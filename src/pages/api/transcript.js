import logger from "@/utils/logger";
import cache, { TTL } from '@/utils/cache';
import { cacheGet, cacheSet } from '@/utils/redis-cache';
import {
  getInnertube,
  resetInnertube,
  decodeEntities,
  selectBestLanguage,
  HIGH_CONFIDENCE_LANGUAGES
} from '@/utils/innertube';
import { proxyFetch, isProxyConfigured, isDirectBlocked, recordDirectBlock, isYouTubeBlockResponse } from '@/utils/proxy';

/**
 * Fetch transcript using youtubei.js caption URL directly
 */
async function fetchTranscriptWithInnerTube(videoId, langCode = null, existingInfo = null) {
  try {
    logger.fetch(`Fetching transcript`, `Video: ${videoId}${langCode ? ` | Language: ${langCode}` : ''}`);
    const yt = await getInnertube();
    const info = existingInfo || await yt.getInfo(videoId);

    if (!info || !info.captions) {
      logger.warn(`youtubei.js: No captions object`, `Video: ${videoId}`);
      return { success: false, error: 'No captions available', hasCaptionsObject: false, hasTrack: false };
    }

    const captionTracks = info.captions.caption_tracks || [];
    if (captionTracks.length === 0) {
      logger.warn(`youtubei.js: No caption tracks`, `Video: ${videoId}`);
      return { success: false, error: 'No caption tracks', hasCaptionsObject: true, hasTrack: false };
    }

    // Find the best caption track
    let track = captionTracks[0];
    if (langCode) {
      const langTrack = captionTracks.find(t => t.language_code === langCode);
      if (langTrack) track = langTrack;
    } else {
      // Prefer English
      const enTrack = captionTracks.find(t => t.language_code === 'en' || t.language_code?.startsWith('en'));
      if (enTrack) track = enTrack;
    }

    logger.info(`youtubei.js: Using caption track`, `Video: ${videoId} | Lang: ${track.language_code}`);

    // Fetch captions using json3 format (cleaner than XML, no entity decoding needed)
    const captionUrl = track.base_url;
    if (!captionUrl) {
      logger.warn(`youtubei.js: No base_url in track`, `Video: ${videoId}`);
      return { success: false, error: 'No caption URL', hasCaptionsObject: true, hasTrack: true };
    }

    const json3Url = captionUrl + '&fmt=json3';

    const captionHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': `https://www.youtube.com/watch?v=${videoId}`,
      'Origin': 'https://www.youtube.com'
    };

    let captionData;

    // Try direct fetch first (skip if our IP is YouTube-blocked)
    if (!isDirectBlocked()) {
      try {
        const response = await fetch(json3Url, { headers: captionHeaders });
        if (isYouTubeBlockResponse(response.status)) {
          recordDirectBlock();
          throw new Error(`YouTube blocked direct IP (${response.status})`);
        }
        if (!response.ok) {
          throw new Error(`Caption fetch failed: ${response.status}`);
        }
        captionData = await response.json();
      } catch (fetchError) {
        logger.warn(`Direct fetch failed`, `Video: ${videoId} | ${fetchError.message}`);
      }
    } else {
      logger.info(`Skipping direct fetch (IP blocked)`, `Video: ${videoId}`);
    }

    // Fallback to proxy pool
    if (!captionData) {
      if (!isProxyConfigured()) {
        logger.warn(`No proxy available`, `Video: ${videoId}`);
        return { success: false, error: 'Direct fetch failed and no proxy configured', hasCaptionsObject: true, hasTrack: true };
      }

      try {
        const proxyResult = await proxyFetch(json3Url, captionHeaders);
        logger.info(`Proxy succeeded after ${proxyResult.hops} hop(s)`, `Video: ${videoId}`);
        captionData = JSON.parse(proxyResult.body);
      } catch (proxyError) {
        logger.warn(`Proxy failed after all hops`, `Video: ${videoId} | Error: ${proxyError.message}`);
        return { success: false, error: proxyError.message, hasCaptionsObject: true, hasTrack: true };
      }
    }

    if (!captionData) {
      logger.warn(`youtubei.js: No caption data received`, `Video: ${videoId}`);
      return { success: false, error: 'Caption fetch failed', hasCaptionsObject: true, hasTrack: true };
    }

    // Parse json3 format: { events: [{ tStartMs, dDurationMs, segs: [{ utf8 }] }] }
    const events = captionData.events || [];
    const entries = [];

    for (const event of events) {
      if (!event.segs) continue;
      const text = event.segs.map(s => s.utf8 || '').join('').replace(/\n/g, ' ').trim();
      if (text) {
        entries.push({
          text,
          offset: (event.tStartMs || 0) / 1000,
          duration: (event.dDurationMs || 0) / 1000
        });
      }
    }

    if (entries.length === 0) {
      logger.warn(`youtubei.js: No text extracted from json3`, `Video: ${videoId}`);
      return { success: false, error: 'Transcript content empty (processing)', hasCaptionsObject: true, hasTrack: true };
    }

    logger.success(`youtubei.js: Got ${entries.length} entries`, `Video: ${videoId}`);
    return { success: true, entries };
  } catch (error) {
    logger.error(`youtubei.js fallback failed`, `Video: ${videoId} | Error: ${error.message}`);
    return { success: false, error: error.message, hasCaptionsObject: false, hasTrack: false };
  }
}

async function getTranscriptLanguages(videoId, info = null) {
  try {
    logger.fetch(`Getting available languages`, `Video: ${videoId}`);

    // Use provided info or fetch it
    let videoInfo = info;
    if (!videoInfo) {
      const yt = await getInnertube();
      videoInfo = await yt.getInfo(videoId);
    }

    if (!videoInfo || !videoInfo.captions) {
      logger.info(`No captions available`, `Video: ${videoId}`);
      return { langCodes: [], info: videoInfo };
    }

    const captionTracks = videoInfo.captions?.caption_tracks || [];
    if (captionTracks.length > 0) {
      const langCodes = captionTracks.map(track => track.language_code).filter(Boolean);
      logger.success(`Found ${langCodes.length} languages`, `Video: ${videoId}`);
      return { langCodes, info: videoInfo };
    }

    return { langCodes: [], info: videoInfo };
  } catch (error) {
    logger.warn(`Could not get languages, will try default`, `Video: ${videoId} | Error: ${error.message}`);
    return { langCodes: [], info: null };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    logger.error("Method not allowed", `Method: ${req.method}`);
    return res.status(405).end();
  }

  const { id, type, lang, force = false } = req.body;
  const apiKey = req.headers['api-key'];

  if (apiKey !== process.env.YOUTUBE_API_KEY) {
    logger.error("Invalid API key");
    return res.status(401).json({ message: 'Please provide correct API key' });
  }

  if (!id) {
    logger.error("Missing video ID");
    return res.status(400).json({ message: 'Video ID is required' });
  }

  // Check cache first (include lang in cache key if specified, skip if force=true)
  const cacheKey = cache.generateKey('transcript', { id, type: type || 'regular', ...(lang && { lang }) });
  if (!force) {
    const cached = await cacheGet(cacheKey);
    if (cached) {
      if (cached.unavailable) {
        logger.info(`Cache hit (unavailable) for transcript ${id} - will retry after TTL`);
        return res.status(404).json({ message: cached.reason, retriable: cached.retriable || false });
      }
      logger.info(`Cache hit for transcript ${id}`);
      return res.status(200).json(cached);
    }
  } else {
    logger.info(`Force refresh for transcript ${id} - skipping cache`);
  }

  let selectedLang = null;
  let availableLangCodes = [];

  try {
    // Get available languages and video info in one call
    let { langCodes, info } = await getTranscriptLanguages(id);
    availableLangCodes = langCodes;

    // If no captions found, retry once with a fresh session (stale session fix)
    if (availableLangCodes.length === 0 && info) {
      logger.info(`No captions found, retrying with fresh session`, `Video: ${id}`);
      resetInnertube();
      const retry = await getTranscriptLanguages(id);
      langCodes = retry.langCodes;
      info = retry.info;
      availableLangCodes = langCodes;
    }

    if (availableLangCodes.length > 0) {
      logger.info(`Available languages`, `Codes: ${availableLangCodes.join(', ')}`);

      // Use requested language if available, otherwise fall back to best selection
      if (lang && availableLangCodes.includes(lang)) {
        selectedLang = lang;
        logger.info(`Using requested language`, `Language: ${selectedLang}`);
      } else {
        if (lang) {
          logger.info(`Requested language '${lang}' not available, falling back`);
        }
        selectedLang = selectBestLanguage(availableLangCodes);
        if (selectedLang) {
          logger.info(`Selected language`, `Language: ${selectedLang}`);
        }
      }
    }

    // Use youtubei.js directly for transcript fetching
    const result = await fetchTranscriptWithInnerTube(id, selectedLang, info);
    if (!result.success) {
      const err = new Error(result.error || 'No transcripts available');
      err.hasCaptionsObject = result.hasCaptionsObject;
      err.hasTrack = result.hasTrack;
      throw err;
    }

    const transcript = result.entries;
    logger.info(`Raw transcript data`, `Length: ${transcript.length} entries`);

    let data = '';
    if (type === 'timestamped') {
      transcript.forEach((entry) => {
        var timedString = `time : ${entry.offset} second. Text: ${entry.text}`;
        data += timedString;
      });
    } else {
      transcript.forEach((entry) => {
        data += ' ' + entry.text;
      });
    }
    data = decodeEntities(data);

    logger.success(`Transcript fetched successfully`, `Video: ${id} | Length: ${data.length} chars`);

    // Cache the response
    const response = { data };
    await cacheSet(cacheKey, response, TTL.TRANSCRIPT);

    res.status(200).json(response);
  } catch (error) {
    const noCaptionsErrors = [
      'No captions available',
      'No caption tracks',
      'No transcript text found',
      'Transcript content empty',
      'Transcript is disabled',
    ];
    const isNoCaptions = noCaptionsErrors.some(msg => error.message?.includes(msg));

    if (isNoCaptions) {
      // Determine if retriable based on what YouTube returned
      const retriable = !!(error.hasCaptionsObject || error.hasTrack);
      const reason = retriable ? 'processing' : (error.message?.includes('disabled') ? 'disabled' : 'no_captions');
      const cacheTTL = retriable ? TTL.TRANSCRIPT_UNAVAILABLE : TTL.VIDEO_DETAILS;

      logger.info(`No captions for video`, `Video: ${id} | Reason: ${reason} | Retriable: ${retriable}`);
      await cacheSet(cacheKey, { data: null, unavailable: true, reason, retriable }, cacheTTL);
      return res.status(404).json({ message: error.message, reason, retriable });
    }

    logger.error(`Failed to fetch transcript`, `Video: ${id} | Error: ${error.message}`);
    res.status(500).json({ message: error.message, retriable: true });
  }
}
