import logger from "@/utils/logger";
import {
  getInnertube,
  resetInnertube,
  decodeEntities,
  selectBestLanguage,
  HIGH_CONFIDENCE_LANGUAGES
} from '@/utils/innertube';
import cache, { TTL } from '@/utils/cache';
import { cacheGet, cacheSet } from '@/utils/redis-cache';
import { proxyFetch, isProxyConfigured, isDirectBlocked, recordDirectBlock, isYouTubeBlockResponse } from '@/utils/proxy';

// Get API key from environment variables
const API_KEY = process.env.YOUTUBE_API_KEY;

if (!API_KEY) {
  logger.error("YOUTUBE_API_KEY environment variable is not set!");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const apiKey = req.headers["api-key"];
  if (apiKey !== API_KEY) {
    return res.status(401).json({ message: "Invalid API key" });
  }

  const {
    id,
    transcript: includeTranscript = true,
    timestamped: includeTimestamped = false,
    force = false
  } = req.body;

  if (!id) {
    return res.status(400).json({ message: "Missing video ID" });
  }

  // Check cache first (skip if force=true)
  const cacheKey = cache.generateKey('video-details', { id, includeTranscript, includeTimestamped });
  if (!force) {
    const cached = await cacheGet(cacheKey);
    if (cached) {
      logger.info(`Cache hit for video ${id}`);
      return res.status(200).json(cached);
    }
  } else {
    logger.info(`Force refresh for video ${id} - skipping cache`);
  }

  try {
    logger.fetch(`Video ${id}`);
    const video = await fetchVideo(id);

    let transcript = { available: false, reason: 'not_requested' };
    let timestampedTranscript = null;

    if (includeTranscript || includeTimestamped) {
      // Check transcript cache separately (longer TTL)
      const transcriptCacheKey = cache.generateKey('transcript', { id, timestamped: includeTimestamped });
      const cachedTranscript = force ? null : await cacheGet(transcriptCacheKey);

      if (cachedTranscript) {
        logger.info(`Cache hit for transcript ${id}`);
        transcript = cachedTranscript.transcript;
        timestampedTranscript = cachedTranscript.timestampedTranscript;
      } else {
        if (includeTimestamped) {
          timestampedTranscript = await fetchTimestampedTranscript(id);
          if (!includeTranscript && timestampedTranscript.available) {
            transcript = { available: true, content: timestampedTranscript.regular_content };
          } else {
            transcript = await fetchTranscript(video, id);
          }
        } else {
          transcript = await fetchTranscript(video, id);
        }

        // Cache transcript result:
        // - Available → long TTL (24h)
        // - Unavailable + retriable (processing) → short TTL (5min) to retry soon
        // - Unavailable + not retriable (no CC) → medium TTL (1h) to avoid waste
        const transcriptAvailable = transcript.available || (timestampedTranscript && timestampedTranscript.available);
        const isRetriable = transcript.retriable || (timestampedTranscript && timestampedTranscript.retriable);
        const transcriptTTL = transcriptAvailable ? TTL.TRANSCRIPT : (isRetriable ? TTL.TRANSCRIPT_UNAVAILABLE : TTL.VIDEO_DETAILS);
        await cacheSet(transcriptCacheKey, { transcript, timestampedTranscript }, transcriptTTL);
      }
    }

    const response = formatResponse(video, transcript, timestampedTranscript, includeTranscript, includeTimestamped);

    // Cache the full response - short TTL if transcript is retriable (processing)
    const transcriptRetriable = (includeTranscript && transcript.retriable) || (includeTimestamped && timestampedTranscript && timestampedTranscript.retriable);
    const detailsTTL = transcriptRetriable ? TTL.TRANSCRIPT_UNAVAILABLE : TTL.VIDEO_DETAILS;
    await cacheSet(cacheKey, response, detailsTTL);

    logger.success(`Processed video ${id}`, `Title: ${video.title}`);
    res.status(200).json(response);
  } catch (error) {
    logger.error(`Failed to process video ${id}`, error.message);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function fetchVideo(id) {
  try {
    if (!id) {
      throw new CustomError("Video ID is required", 400);
    }

    const yt = await getInnertube();
    
    logger.fetch(`Fetching video with youtubei.js`, `Video: ${id}`);
    const info = await yt.getInfo(id);
    
    if (!info || !info.basic_info) {
      logger.error(`Video not found: ${id}`);
      throw new CustomError("Video not found or may have been removed", 404);
    }

    const basicInfo = info.basic_info;
    const videoDetails = info.primary_info;
    const secondaryInfo = info.secondary_info;
    
    // Extract channel info
    let channel = null;
    if (secondaryInfo?.owner?.author) {
      const author = secondaryInfo.owner.author;
      channel = {
        id: author.id || null,
        name: author.name || null,
        subscriberCount: secondaryInfo.owner.subscriber_count?.text || null,
        thumbnails: author.thumbnails || [],
        url: author.url || null,
      };
    } else if (basicInfo.author) {
      channel = {
        id: basicInfo.channel_id || null,
        name: basicInfo.author || null,
        subscriberCount: null,
        thumbnails: [],
        url: basicInfo.channel_id ? `https://www.youtube.com/channel/${basicInfo.channel_id}` : null,
      };
    }

    // Extract chapters if available
    let chapters = [];
    if (info.player_overlays?.decorated_player_bar?.player_bar?.markers_map) {
      const markersMap = info.player_overlays.decorated_player_bar.player_bar.markers_map;
      const chapterMarkers = markersMap.find(m => m.key === 'AUTO_CHAPTERS' || m.key === 'DESCRIPTION_CHAPTERS');
      if (chapterMarkers?.value?.chapters) {
        chapters = chapterMarkers.value.chapters.map(ch => ({
          title: ch.title?.text || ch.title || '',
          start: ch.time_range_start_millis / 1000,
        }));
      }
    }

    // Build normalized video object
    const video = {
      id: basicInfo.id || id,
      title: basicInfo.title || null,
      description: basicInfo.short_description || null,
      duration: basicInfo.duration || null,
      viewCount: basicInfo.view_count || null,
      likeCount: basicInfo.like_count || null,
      isLiveContent: basicInfo.is_live || false,
      isUpcoming: basicInfo.is_upcoming || false,
      startTimestamp: basicInfo.start_timestamp || null,
      uploadDate: videoDetails?.published?.text || videoDetails?.relative_date?.text || null,
      channel: channel,
      chapters: chapters,
      // Store captions info for transcript fetching
      _captions: info.captions,
      _hasCaption: basicInfo.has_captions || false,
    };

    return video;
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }
    
    // Handle specific youtubei.js errors
    if (error.message?.includes('Video unavailable') || 
        error.message?.includes('Private video') ||
        error.message?.includes('Sign in')) {
      logger.error(`Video unavailable: ${id}`, error.message);
      throw new CustomError("Video is unavailable, private, or requires sign-in", 403);
    }
    
    if (error.message?.includes('network') || error.message?.includes('timeout') || error.message?.includes('ECONNREFUSED')) {
      logger.error(`Network error for ${id}`, error.message);
      throw new CustomError("Network error while accessing YouTube. Please try again later.", 503);
    }

    logger.error(`Error fetching video ${id}`, error.message);
    throw new CustomError(error.message || "Failed to fetch video", 500);
  }
}

/**
 * Fetch transcript using youtubei.js caption URL directly.
 * Returns { success, content, method } on success.
 * Returns { success: false, error, hasCaptionsObject, hasTrack } on failure
 * so callers can determine retriability.
 */
async function fetchTranscriptWithInnerTube(videoId) {
  try {
    let yt = await getInnertube();
    let info = await yt.getInfo(videoId);

    // Stale session retry: if no captions found, reset session and try once more
    if (info && !info.captions) {
      logger.info(`No captions on first try, retrying with fresh session`, `Video: ${videoId}`);
      resetInnertube();
      yt = await getInnertube();
      info = await yt.getInfo(videoId);
    }

    if (!info || !info.captions) {
      return { success: false, error: 'No captions available', hasCaptionsObject: false, hasTrack: false };
    }

    const captionTracks = info.captions.caption_tracks || [];
    if (captionTracks.length === 0) {
      return { success: false, error: 'No caption tracks', hasCaptionsObject: true, hasTrack: false };
    }

    // Prefer English track
    let track = captionTracks[0];
    const enTrack = captionTracks.find(t => t.language_code === 'en' || t.language_code?.startsWith('en'));
    if (enTrack) track = enTrack;

    const captionUrl = track.base_url;
    if (!captionUrl) {
      return { success: false, error: 'No caption URL', hasCaptionsObject: true, hasTrack: true };
    }

    const captionHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': `https://www.youtube.com/watch?v=${videoId}`
    };

    // Try direct fetch first (skip if our IP is YouTube-blocked)
    // Use global fetch() - NOT yt.session.http.fetch() which prepends InnerTube base URL
    let xml;
    if (!isDirectBlocked()) {
      try {
        const response = await fetch(captionUrl, { headers: captionHeaders });
        const body = await response.text();
        if (isYouTubeBlockResponse(response.status, body)) {
          recordDirectBlock();
          throw new Error(`YouTube blocked direct IP (${response.status})`);
        }
        xml = body;
      } catch (fetchError) {
        logger.warn(`Direct caption fetch failed`, `Video: ${videoId} | ${fetchError.message}`);
      }
    } else {
      logger.info(`Skipping direct fetch (IP blocked)`, `Video: ${videoId}`);
    }

    // Fallback to proxy pool
    if (!xml) {
      if (!isProxyConfigured()) {
        return { success: false, error: 'Direct fetch failed and no proxy configured', hasCaptionsObject: true, hasTrack: true };
      }

      try {
        const proxyResult = await proxyFetch(captionUrl, captionHeaders);
        logger.info(`Proxy succeeded after ${proxyResult.hops} hop(s)`, `Video: ${videoId}`);
        xml = proxyResult.body;
      } catch (proxyError) {
        logger.warn(`Proxy failed after all hops`, `Video: ${videoId} | Error: ${proxyError.message}`);
        return { success: false, error: proxyError.message, hasCaptionsObject: true, hasTrack: true };
      }
    }

    // Parse XML to extract text
    const textRegex = /<text[^>]*>([^<]*)<\/text>/g;
    let text = '';
    let match;

    while ((match = textRegex.exec(xml)) !== null) {
      const segment = match[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n/g, ' ')
        .trim();

      if (segment) {
        text += ' ' + segment;
      }
    }

    if (!text.trim()) {
      return { success: false, error: 'Transcript content empty (processing)', hasCaptionsObject: true, hasTrack: true };
    }

    return { success: true, content: decodeEntities(text.trim()), method: 'youtubei.js' };
  } catch (error) {
    return { success: false, error: error.message, hasCaptionsObject: false, hasTrack: false };
  }
}

/**
 * Fetch timestamped transcript using youtubei.js with existing info object
 */
async function fetchTranscriptWithInnerTubeTimestamped(info, videoId, langCode = null) {
  try {
    if (!info || !info.captions) {
      return { success: false, error: 'No captions available' };
    }

    const captionTracks = info.captions.caption_tracks || [];
    if (captionTracks.length === 0) {
      return { success: false, error: 'No caption tracks' };
    }

    // Find the best caption track
    let track = captionTracks[0];
    if (langCode) {
      const langTrack = captionTracks.find(t => t.language_code === langCode);
      if (langTrack) track = langTrack;
    } else {
      // Prefer English track
      const enTrack = captionTracks.find(t => t.language_code === 'en' || t.language_code?.startsWith('en'));
      if (enTrack) track = enTrack;
    }

    const captionUrl = track.base_url;
    if (!captionUrl) {
      return { success: false, error: 'No caption URL' };
    }

    const captionHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': `https://www.youtube.com/watch?v=${videoId}`
    };

    // Try direct fetch first (skip if our IP is YouTube-blocked)
    // Use global fetch() - NOT yt.session.http.fetch() which prepends InnerTube base URL
    let xml;
    if (!isDirectBlocked()) {
      try {
        const response = await fetch(captionUrl, { headers: captionHeaders });
        const body = await response.text();
        if (isYouTubeBlockResponse(response.status, body)) {
          recordDirectBlock();
          throw new Error(`YouTube blocked direct IP (${response.status})`);
        }
        xml = body;
      } catch (fetchError) {
        logger.warn(`Direct caption fetch failed`, `Video: ${videoId} | ${fetchError.message}`);
      }
    } else {
      logger.info(`Skipping direct fetch (IP blocked)`, `Video: ${videoId}`);
    }

    // Fallback to proxy pool
    if (!xml) {
      if (!isProxyConfigured()) {
        return { success: false, error: 'Direct fetch failed and no proxy configured' };
      }

      try {
        const proxyResult = await proxyFetch(captionUrl, captionHeaders);
        logger.info(`Proxy succeeded after ${proxyResult.hops} hop(s)`, `Video: ${videoId}`);
        xml = proxyResult.body;
      } catch (proxyError) {
        logger.warn(`Proxy failed after all hops`, `Video: ${videoId} | Error: ${proxyError.message}`);
        return { success: false, error: proxyError.message };
      }
    }

    // Parse XML to extract text with timestamps
    const textRegex = /<text[^>]*start="([^"]*)"[^>]*>([^<]*)<\/text>/g;
    const entries = [];
    let match;

    while ((match = textRegex.exec(xml)) !== null) {
      const text = match[2]
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
          offset: parseFloat(match[1]) || 0
        });
      }
    }

    if (entries.length === 0) {
      return { success: false, error: 'No transcript text found' };
    }

    return { success: true, entries };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function fetchTranscript(video, videoId) {
  if (!video || video.isLiveContent) {
    logger.info(`No transcript - Live content`, `Video: ${videoId}`);
    return { available: false, reason: 'live_content', retriable: false };
  }

  try {
    logger.fetch(`Transcript for ${videoId}`);

    // Use youtubei.js directly for transcript fetching
    const result = await fetchTranscriptWithInnerTube(videoId);
    if (result.success) {
      logger.success(`Got transcript for ${videoId}`);
      return { available: true, content: result.content, retriable: false };
    }

    // Determine state based on what YouTube returned
    if (result.hasTrack) {
      // Caption track exists but content is empty/failed - YouTube is likely still processing
      logger.info(`Transcript processing (track exists, content empty)`, `Video: ${videoId}`);
      return { available: false, reason: 'processing', retriable: true };
    }

    if (result.hasCaptionsObject) {
      // Captions system exists but no tracks yet - could be processing
      logger.info(`Transcript processing (captions object exists, no tracks)`, `Video: ${videoId}`);
      return { available: false, reason: 'processing', retriable: true };
    }

    // No captions system at all
    // But if video was a recently ended live stream, YouTube may still be processing VOD captions
    if (video.startTimestamp) {
      const streamStart = new Date(video.startTimestamp).getTime();
      const durationMs = (video.duration || 0) * 1000;
      const streamEnd = streamStart + durationMs;
      const timeSinceEnd = Date.now() - streamEnd;
      const threeHours = 3 * 60 * 60 * 1000;
      if (timeSinceEnd < threeHours) {
        logger.info(`No transcript yet - stream ended <3h ago, may still be processing`, `Video: ${videoId}`);
        return { available: false, reason: 'processing', retriable: true };
      }
      logger.info(`No transcript - past live stream ended >3h ago, likely no captions`, `Video: ${videoId}`);
    }

    logger.info(`No transcript - No captions`, `Video: ${videoId}`);
    return { available: false, reason: 'no_captions', retriable: false };
  } catch (error) {
    if (error.message?.includes('Transcript is disabled')) {
      logger.info(`No transcript - Disabled`, `Video: ${videoId}`);
      return { available: false, reason: 'disabled', retriable: false };
    }

    logger.warn(`Transcript fetch error for ${videoId}`, error.message);
    return { available: false, reason: 'error', error: error.message, retriable: true };
  }
}

async function fetchTimestampedTranscript(videoId) {
  try {
    let selectedLang = null;
    let availableLangCodes = [];

    // Get available languages from youtubei.js
    let yt = await getInnertube();
    let info = await yt.getInfo(videoId);

    // Stale session retry: if no captions found, reset session and try once more
    if (info && !info.captions) {
      logger.info(`No captions on first try, retrying with fresh session`, `Video: ${videoId}`);
      resetInnertube();
      yt = await getInnertube();
      info = await yt.getInfo(videoId);
    }

    if (info?.captions?.caption_tracks) {
      availableLangCodes = info.captions.caption_tracks
        .map(track => track.language_code)
        .filter(Boolean);
      logger.info(`Available languages`, `Count: ${availableLangCodes.length}`);
    }

    // Select best language using shared utility
    selectedLang = selectBestLanguage(availableLangCodes);

    if (selectedLang) {
      logger.info(`Selected language`, `Language: ${selectedLang}`);
    }

    logger.fetch(`Fetching timestamped transcript`, `Video: ${videoId}${selectedLang ? ` | Language: ${selectedLang}` : ''}`);

    // Use youtubei.js directly for transcript fetching
    const result = await fetchTranscriptWithInnerTubeTimestamped(info, videoId, selectedLang);

    if (!result.success) {
      logger.info(`Timestamped transcript failed`, `Video: ${videoId} | Error: ${result.error}`);
      return { available: false, reason: 'fetch_failed', error: result.error };
    }

    const entries = result.entries;
    logger.info(`Raw transcript data`, `Length: ${entries.length} entries`);

    let timestampedData = '';
    let regularData = '';
    let timestampedArray = [];

    entries.forEach((entry) => {
      const timedString = `time: ${entry.offset} second. Text: ${entry.text}`;
      timestampedArray.push(timedString);
      regularData += ' ' + entry.text;
    });

    timestampedData = timestampedArray.join('\n');
    timestampedData = decodeEntities(timestampedData);
    regularData = decodeEntities(regularData.trim());

    logger.success(`Timestamped transcript fetched successfully`, `Video: ${videoId} | Length: ${timestampedData.length} chars`);

    return {
      available: true,
      content: timestampedData,
      content_array: timestampedArray.map(item => decodeEntities(item)),
      regular_content: regularData,
      language: selectedLang,
      available_languages: availableLangCodes
    };
  } catch (error) {
    if (error.message?.includes('Transcript is disabled')) {
      logger.info(`Timestamped transcript disabled`, `Video: ${videoId}`);
      return { available: false, reason: 'disabled' };
    } else {
      logger.error(`Failed to fetch timestamped transcript`, `Video: ${videoId} | Error: ${error.message}`);
      return { available: false, reason: 'error', error: error.message };
    }
  }
}

function formatResponse(video, transcript, timestampedTranscript, includeTranscript, includeTimestamped) {
  const response = {
    id: video.id,
    channel: video.channel ? {
      youtube_channel_id: video.channel.id,
      name: video.channel.name,
      subscriberCount: video.channel.subscriberCount,
      thumbnails: video.channel.thumbnails,
      url: video.channel.url,
    } : null,
    title: video.title,
    chapters: video.chapters || [],
    description: video.description,
    duration: video.duration,
    likeCount: video.likeCount,
    isLiveContent: video.isLiveContent,
    isUpcoming: video.isUpcoming,
    startTimestamp: video.startTimestamp,
    uploadDate: video.uploadDate,
    viewCount: video.viewCount,
  };

  if (includeTranscript) {
    response.transcript = transcript.available ? transcript.content : null;
    response.transcript_status = {
      available: transcript.available,
      reason: transcript.reason,
      retriable: transcript.retriable || false,
    };
  }

  if (includeTimestamped && timestampedTranscript) {
    response.timestamped_transcript = timestampedTranscript.available ? timestampedTranscript.content : null;
    response.timestamped_transcript_array = timestampedTranscript.available ? timestampedTranscript.content_array : null;
    response.timestamped_transcript_status = {
      available: timestampedTranscript.available,
      reason: timestampedTranscript.reason,
      language: timestampedTranscript.language,
      available_languages: timestampedTranscript.available_languages
    };
  }

  return response;
}

class CustomError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}
