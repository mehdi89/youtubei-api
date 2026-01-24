import logger from "@/utils/logger";
import { YoutubeTranscript } from '@/utils/youtube-transcript/dist/youtube-transcript.common.js';
import { 
  getInnertube, 
  decodeEntities, 
  selectBestLanguage,
  HIGH_CONFIDENCE_LANGUAGES 
} from '@/utils/innertube';

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
    timestamped: includeTimestamped = false 
  } = req.body;
  
  if (!id) {
    return res.status(400).json({ message: "Missing video ID" });
  }

  try {
    logger.fetch(`Video ${id}`);
    const video = await fetchVideo(id);
    
    let transcript = { available: false, reason: 'not_requested' };
    let timestampedTranscript = null;
    
    if (includeTranscript || includeTimestamped) {
      if (includeTimestamped) {
        // Fetch timestamped transcript
        timestampedTranscript = await fetchTimestampedTranscript(id);
        if (!includeTranscript && timestampedTranscript.available) {
          transcript = { available: true, content: timestampedTranscript.regular_content };
        } else {
          transcript = await fetchTranscript(video, id);
        }
      } else {
        transcript = await fetchTranscript(video, id);
      }
    }

    const response = formatResponse(video, transcript, timestampedTranscript, includeTranscript, includeTimestamped);
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
 * Fetch transcript using youtubei.js caption URL directly
 */
async function fetchTranscriptWithInnerTube(videoId) {
  try {
    const yt = await getInnertube();
    const info = await yt.getInfo(videoId);

    if (!info || !info.captions) {
      return { success: false, error: 'No captions available' };
    }

    const captionTracks = info.captions.caption_tracks || [];
    if (captionTracks.length === 0) {
      return { success: false, error: 'No caption tracks' };
    }

    // Prefer English track
    let track = captionTracks[0];
    const enTrack = captionTracks.find(t => t.language_code === 'en' || t.language_code?.startsWith('en'));
    if (enTrack) track = enTrack;

    const captionUrl = track.base_url;
    if (!captionUrl) {
      return { success: false, error: 'No caption URL' };
    }

    // Use the innertube's http client to make the request (includes proper auth)
    let xml;
    try {
      const response = await yt.session.http.fetch(captionUrl);
      xml = await response.text();
    } catch (fetchError) {
      // Fallback to direct fetch with headers
      const response = await fetch(captionUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': `https://www.youtube.com/watch?v=${videoId}`
        }
      });
      if (!response.ok) {
        return { success: false, error: `Caption fetch failed: ${response.status}` };
      }
      xml = await response.text();
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
      return { success: false, error: 'No transcript text found' };
    }

    return { success: true, content: decodeEntities(text.trim()), method: 'youtubei.js' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function tryGetTranscriptWithYoutubeTranscript(videoId) {
  // Try YoutubeTranscript first
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    let text = '';
    transcript.forEach((entry) => {
      text += ' ' + entry.text;
    });
    return { success: true, content: decodeEntities(text.trim()), method: 'YoutubeTranscript' };
  } catch (error) {
    // Fallback to youtubei.js
    logger.warn(`YoutubeTranscript failed for ${videoId}, trying youtubei.js`);
    const innertubeResult = await fetchTranscriptWithInnerTube(videoId);
    if (innertubeResult.success) {
      return innertubeResult;
    }
    return { success: false, error };
  }
}

async function fetchTranscript(video, videoId) {
  if (!video || video.isLiveContent) {
    logger.info(`No transcript - Live content`, `Video: ${videoId}`);
    return { available: false, reason: 'live_content' };
  }

  try {
    logger.fetch(`Transcript for ${videoId}`);
    
    // Use YoutubeTranscript library (more reliable)
    const ytTranscriptResult = await tryGetTranscriptWithYoutubeTranscript(videoId);
    if (ytTranscriptResult.success) {
      logger.success(`Got transcript for ${videoId} using YoutubeTranscript`);
      return { available: true, content: ytTranscriptResult.content };
    }

    // If YoutubeTranscript fails and no captions available
    if (!video._hasCaption) {
      logger.info(`No transcript - No captions`, `Video: ${videoId}`);
      return { available: false, reason: 'no_captions' };
    }

    logger.info(`No transcript available`, `Video: ${videoId}`);
    return { available: false, reason: 'fetch_failed' };
  } catch (error) {
    if (error.message?.includes('Transcript is disabled') || 
        error.name === 'YoutubeTranscriptDisabledError') {
      logger.info(`No transcript - Disabled`, `Video: ${videoId}`);
      return { available: false, reason: 'disabled' };
    }

    logger.warn(`Transcript fetch error for ${videoId}`, error.message);
    return { available: false, reason: 'error', error: error.message };
  }
}

async function fetchTimestampedTranscript(videoId) {
  try {
    let selectedLang = null;
    let availableLangCodes = [];

    // Try to get available languages using YoutubeTranscript
    try {
      const transcriptList = await YoutubeTranscript.listTranscripts(videoId);
      if (transcriptList && transcriptList.length > 0) {
        availableLangCodes = transcriptList.map(t => t.languageCode || t.lang).filter(Boolean);
        logger.info(`Available languages`, `Count: ${availableLangCodes.length}`);
      }
    } catch (e) {
      logger.warn(`Could not list transcripts`, `Video: ${videoId}`);
    }

    // Select best language using shared utility
    selectedLang = selectBestLanguage(availableLangCodes);

    if (selectedLang) {
      logger.info(`Selected language`, `Language: ${selectedLang}`);
    }

    const options = selectedLang ? { lang: selectedLang } : {};
    logger.fetch(`Fetching timestamped transcript`, `Video: ${videoId}${selectedLang ? ` | Language: ${selectedLang}` : ''}`);

    const transcript = await YoutubeTranscript.fetchTranscript(videoId, options);
    logger.info(`Raw transcript data`, `Length: ${transcript.length} entries`);
    
    let timestampedData = '';
    let regularData = '';
    let timestampedArray = [];
    
    transcript.forEach((entry) => {
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
    uploadDate: video.uploadDate,
    viewCount: video.viewCount,
  };

  if (includeTranscript) {
    response.transcript = transcript.available ? transcript.content : null;
    response.transcript_status = {
      available: transcript.available,
      reason: transcript.reason
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
