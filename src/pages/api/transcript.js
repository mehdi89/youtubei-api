import { YoutubeTranscript } from '@/utils/youtube-transcript/dist/youtube-transcript.common.js';
import logger from "@/utils/logger";
import cache, { TTL } from '@/utils/cache';
import {
  getInnertube,
  decodeEntities,
  selectBestLanguage,
  HIGH_CONFIDENCE_LANGUAGES
} from '@/utils/innertube';

/**
 * Fetch transcript using youtubei.js caption URL directly
 */
async function fetchTranscriptWithInnerTube(videoId, langCode = null) {
  try {
    logger.info(`Trying youtubei.js fallback`, `Video: ${videoId}`);
    const yt = await getInnertube();
    const info = await yt.getInfo(videoId);

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

    // Fetch the caption XML using the innertube session
    const captionUrl = track.base_url;
    if (!captionUrl) {
      logger.warn(`youtubei.js: No base_url in track`, `Video: ${videoId}`);
      return { success: false, error: 'No caption URL' };
    }

    // Fetch with retry logic for rate limiting
    let xml;
    const maxRetries = 3;
    const baseDelay = 1000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Try session fetch first
        try {
          const response = await yt.session.http.fetch(captionUrl);
          xml = await response.text();
          break;
        } catch (sessionError) {
          // Fallback to direct fetch with headers
          if (attempt === 0) {
            logger.warn(`youtubei.js: Session fetch failed, trying direct`, `Video: ${videoId}`);
          }
          const response = await fetch(captionUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept-Language': 'en-US,en;q=0.9',
              'Referer': `https://www.youtube.com/watch?v=${videoId}`,
              'Origin': 'https://www.youtube.com'
            }
          });

          if (response.status === 429) {
            // Rate limited - wait and retry
            const delay = baseDelay * Math.pow(2, attempt);
            logger.warn(`youtubei.js: Rate limited, retrying in ${delay}ms`, `Video: ${videoId} | Attempt: ${attempt + 1}`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }

          if (!response.ok) {
            logger.warn(`youtubei.js: Caption fetch failed`, `Video: ${videoId} | Status: ${response.status}`);
            return { success: false, error: `Caption fetch failed: ${response.status}` };
          }
          xml = await response.text();
          break;
        }
      } catch (fetchError) {
        if (attempt === maxRetries - 1) {
          throw fetchError;
        }
      }
    }

    if (!xml) {
      logger.warn(`youtubei.js: Failed after ${maxRetries} retries`, `Video: ${videoId}`);
      return { success: false, error: 'Caption fetch failed after retries' };
    }

    // Parse XML to extract text segments
    // Format: <text start="0" dur="5.5">Text here</text>
    const textRegex = /<text[^>]*start="([^"]*)"[^>]*dur="([^"]*)"[^>]*>([^<]*)<\/text>/g;
    const entries = [];
    let match;

    while ((match = textRegex.exec(xml)) !== null) {
      const text = match[3]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n/g, ' ')
        .trim();

      if (text) {
        entries.push({
          text,
          offset: parseFloat(match[1]) || 0,
          duration: parseFloat(match[2]) || 0
        });
      }
    }

    if (entries.length === 0) {
      logger.warn(`youtubei.js: No text extracted from XML`, `Video: ${videoId}`);
      return { success: false, error: 'No transcript text found' };
    }

    logger.success(`youtubei.js: Got ${entries.length} entries`, `Video: ${videoId}`);
    return { success: true, entries };
  } catch (error) {
    logger.error(`youtubei.js fallback failed`, `Video: ${videoId} | Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function getTranscriptLanguages(videoId) {
  try {
    logger.fetch(`Getting available languages`, `Video: ${videoId}`);
    
    // Try using YoutubeTranscript's listTranscripts first
    try {
      const transcriptList = await YoutubeTranscript.listTranscripts(videoId);
      if (transcriptList && transcriptList.length > 0) {
        const langCodes = transcriptList.map(t => t.languageCode || t.lang).filter(Boolean);
        logger.success(`Found ${langCodes.length} languages via YoutubeTranscript`, `Video: ${videoId}`);
        return langCodes;
      }
    } catch (e) {
      // listTranscripts might not be available, try youtubei.js
    }

    // Fallback to youtubei.js
    const yt = await getInnertube();
    const info = await yt.getInfo(videoId);
    
    if (!info || !info.captions) {
      logger.info(`No captions available`, `Video: ${videoId}`);
      return [];
    }

    // Try to get caption tracks from youtubei.js
    const captionTracks = info.captions?.caption_tracks || [];
    if (captionTracks.length > 0) {
      const langCodes = captionTracks.map(track => track.language_code).filter(Boolean);
      logger.success(`Found ${langCodes.length} languages via youtubei.js`, `Video: ${videoId}`);
      return langCodes;
    }

    return [];
  } catch (error) {
    logger.warn(`Could not get languages, will try default`, `Video: ${videoId} | Error: ${error.message}`);
    return [];
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    logger.error("Method not allowed", `Method: ${req.method}`);
    return res.status(405).end();
  }

  const { id, type } = req.body;
  const apiKey = req.headers['api-key'];

  if (apiKey !== process.env.YOUTUBE_API_KEY) {
    logger.error("Invalid API key");
    return res.status(401).json({ message: 'Please provide correct API key' });
  }

  if (!id) {
    logger.error("Missing video ID");
    return res.status(400).json({ message: 'Video ID is required' });
  }

  // Check cache first
  const cacheKey = cache.generateKey('transcript', { id, type: type || 'regular' });
  const cached = cache.get(cacheKey);
  if (cached) {
    logger.info(`Cache hit for transcript ${id}`);
    return res.status(200).json(cached);
  }

  let selectedLang = null;
  let availableLangCodes = [];

  try {
    // Get available languages first (this is optional, transcript will still work without it)
    availableLangCodes = await getTranscriptLanguages(id);
    
    if (availableLangCodes.length > 0) {
      logger.info(`Available languages`, `Codes: ${availableLangCodes.join(', ')}`);
      
      // Use shared language selection utility
      selectedLang = selectBestLanguage(availableLangCodes);
      
      if (selectedLang) {
        logger.info(`Selected language`, `Language: ${selectedLang}`);
      }
    }

    const options = selectedLang ? { lang: selectedLang } : {};
    logger.fetch(`Fetching transcript`, `Video: ${id}${selectedLang ? ` | Language: ${selectedLang}` : ''}`);

    let transcript = null;
    let fetchMethod = '';

    // Try YoutubeTranscript first
    try {
      transcript = await YoutubeTranscript.fetchTranscript(id, options);
      fetchMethod = 'YoutubeTranscript';
    } catch (ytError) {
      logger.warn(`YoutubeTranscript failed, trying youtubei.js`, `Video: ${id}`);

      // Fallback to youtubei.js
      const innertubeResult = await fetchTranscriptWithInnerTube(id, selectedLang);
      if (innertubeResult.success) {
        transcript = innertubeResult.entries;
        fetchMethod = 'youtubei.js';
      } else {
        // Both methods failed
        throw new Error(ytError.message || 'No transcripts available');
      }
    }

    logger.info(`Raw transcript data`, `Length: ${transcript.length} entries | Method: ${fetchMethod}`);

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

    logger.success(`Transcript fetched successfully`, `Video: ${id} | Length: ${data.length} chars | Method: ${fetchMethod}`);

    // Cache the response
    const response = { data };
    cache.set(cacheKey, response, TTL.TRANSCRIPT);

    res.status(200).json(response);
  } catch (error) {
    if (error.message?.includes('Transcript is disabled')) {
      logger.info(`Transcript disabled`, `Video: ${id}`);
    } else {
      logger.error(`Failed to fetch transcript`, `Video: ${id} | Error: ${error.message}`);
    }
    res.status(500).json({ message: error.message });
  }
}
