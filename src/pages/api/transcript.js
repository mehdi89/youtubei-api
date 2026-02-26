import logger from "@/utils/logger";
import cache, { TTL } from '@/utils/cache';
import {
  getInnertube,
  resetInnertube,
  decodeEntities,
  selectBestLanguage,
  HIGH_CONFIDENCE_LANGUAGES
} from '@/utils/innertube';
import { withProxy, isProxyConfigured } from '@/utils/proxy';

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
      return { success: false, error: 'No captions available' };
    }

    const captionTracks = info.captions.caption_tracks || [];
    if (captionTracks.length === 0) {
      logger.warn(`youtubei.js: No caption tracks`, `Video: ${videoId}`);
      return { success: false, error: 'No caption tracks' };
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
      return { success: false, error: 'No caption URL' };
    }

    const json3Url = captionUrl + '&fmt=json3';

    let captionData;
    try {
      // Try direct fetch first (json3 URLs don't need innertube session auth)
      const response = await fetch(json3Url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': `https://www.youtube.com/watch?v=${videoId}`,
          'Origin': 'https://www.youtube.com'
        }
      });
      if (!response.ok) {
        throw new Error(`Caption fetch failed: ${response.status}`);
      }
      captionData = await response.json();
    } catch (fetchError) {
      // Fallback to proxy if configured
      logger.warn(`youtubei.js: Direct fetch failed, trying proxy`, `Video: ${videoId}`);

      const useProxy = isProxyConfigured();
      if (useProxy) {
        logger.info('Using proxy for caption fetch', `Video: ${videoId}`);
      }

      const doFetch = async (dispatcher) => {
        const response = await fetch(json3Url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': `https://www.youtube.com/watch?v=${videoId}`,
            'Origin': 'https://www.youtube.com'
          },
          ...(dispatcher && { dispatcher })
        });
        if (!response.ok) {
          throw new Error(`Caption fetch failed: ${response.status}`);
        }
        return response.json();
      };

      try {
        captionData = await withProxy(doFetch);
      } catch (proxyError) {
        logger.warn(`youtubei.js: Caption fetch failed`, `Video: ${videoId} | Error: ${proxyError.message}`);
        return { success: false, error: proxyError.message };
      }
    }

    if (!captionData) {
      logger.warn(`youtubei.js: No caption data received`, `Video: ${videoId}`);
      return { success: false, error: 'Caption fetch failed' };
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
      return { success: false, error: 'No transcript text found' };
    }

    logger.success(`youtubei.js: Got ${entries.length} entries`, `Video: ${videoId}`);
    return { success: true, entries };
  } catch (error) {
    logger.error(`youtubei.js fallback failed`, `Video: ${videoId} | Error: ${error.message}`);
    return { success: false, error: error.message };
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

  const { id, type, lang } = req.body;
  const apiKey = req.headers['api-key'];

  if (apiKey !== process.env.YOUTUBE_API_KEY) {
    logger.error("Invalid API key");
    return res.status(401).json({ message: 'Please provide correct API key' });
  }

  if (!id) {
    logger.error("Missing video ID");
    return res.status(400).json({ message: 'Video ID is required' });
  }

  // Check cache first (include lang in cache key if specified)
  const cacheKey = cache.generateKey('transcript', { id, type: type || 'regular', ...(lang && { lang }) });
  const cached = cache.get(cacheKey);
  if (cached) {
    logger.info(`Cache hit for transcript ${id}`);
    return res.status(200).json(cached);
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
      throw new Error(result.error || 'No transcripts available');
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
    cache.set(cacheKey, response, TTL.TRANSCRIPT);

    res.status(200).json(response);
  } catch (error) {
    const noCaptionsErrors = [
      'No captions available',
      'No caption tracks',
      'No transcript text found',
      'Transcript is disabled',
    ];
    const isNoCaptions = noCaptionsErrors.some(msg => error.message?.includes(msg));

    if (isNoCaptions) {
      logger.info(`No captions for video`, `Video: ${id} | Reason: ${error.message}`);
      return res.status(404).json({ message: error.message });
    }

    logger.error(`Failed to fetch transcript`, `Video: ${id} | Error: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
}
