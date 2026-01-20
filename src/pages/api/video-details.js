// Polyfill localStorage for server-side (youtubei uses it for caching)
if (typeof globalThis.localStorage === 'undefined') {
  const localStorageData = {};
  globalThis.localStorage = {
    getItem: (key) => localStorageData[key] || null,
    setItem: (key, value) => { localStorageData[key] = String(value); },
    removeItem: (key) => { delete localStorageData[key]; },
    clear: () => { Object.keys(localStorageData).forEach(k => delete localStorageData[k]); },
    get length() { return Object.keys(localStorageData).length; },
    key: (i) => Object.keys(localStorageData)[i] || null
  };
}

import logger from "@/utils/logger";
import { YoutubeTranscript } from '@/utils/youtube-transcript/dist/youtube-transcript.common.js';
import { Client } from 'youtubei';
import axios from 'axios';


// Get API key from environment variables
const API_KEY = process.env.YOUTUBE_API_KEY;

if (!API_KEY) {
  logger.error("YOUTUBE_API_KEY environment variable is not set!");
}

function decodeEntities(encodedString) {
  var translate_re = /&(nbsp|amp|quot|lt|gt);/g;
  var translate = {
    nbsp: ' ',
    amp: '&',
    quot: '"',
    lt: '<',
    gt: '>',
  };
  return encodedString
    .replace(translate_re, function (match, entity) {
      return translate[entity];
    })
    .replace(/&#(\d+);/gi, function (match, numStr) {
      var num = parseInt(numStr, 10);
      return String.fromCharCode(num);
    });
}

async function getTranscriptLanguages(videoId) {
  try {
    const youtube = new Client();
    logger.fetch(`Getting available languages`, `Video: ${videoId}`);

    const video = await youtube.getVideo(videoId);
    if (!video || !video.captions) {
      logger.info(`No captions available`, `Video: ${videoId}`);
      return [];
    }

    const availableCaptions = video.captions.languages || [];
    logger.success(`Found ${availableCaptions.length} languages`, `Video: ${videoId}`);
    return availableCaptions;
  } catch (error) {
    logger.error(`Failed to get languages`, `Video: ${videoId} | Error: ${error.message}`);
    return [];
  }
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
    const video = await fetchVideo(null, id);
    
    let transcript = '';
    let timestampedTranscript = null;
    
    if (includeTranscript || includeTimestamped) {
      if (includeTimestamped) {
        // Fetch timestamped transcript
        timestampedTranscript = await fetchTimestampedTranscript(id);
        if (!includeTranscript && timestampedTranscript.available) {
          // If only timestamped is requested, still get regular transcript for compatibility
          transcript = timestampedTranscript.regular_content || '';
        } else {
          transcript = await fetchTranscript(video);
        }
      } else {
        transcript = await fetchTranscript(video);
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

// Fallback method using YouTube's noembed/oembed API
async function fetchVideoFallback(id) {
  logger.info(`Using fallback method for video`, `Video: ${id}`);
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`;
    const response = await axios.get(oembedUrl, { timeout: 10000 });
    
    if (response.data && response.data.title) {
      // Return a minimal video object compatible with formatResponse
      return {
        id: id,
        title: response.data.title,
        channel: {
          id: null,
          name: response.data.author_name,
          subscriberCount: null,
          thumbnails: [],
          videoCount: null,
          url: response.data.author_url,
        },
        chapters: [],
        description: null,
        duration: null,
        likeCount: null,
        isLiveContent: false,
        uploadDate: null,
        viewCount: null,
        captions: null, // Mark as no captions available via fallback
        _fallback: true, // Flag to indicate fallback was used
      };
    }
    throw new Error('Invalid oembed response');
  } catch (error) {
    logger.error(`Fallback also failed for ${id}`, error.message);
    throw new CustomError("Video not found or unavailable", 404);
  }
}

async function fetchVideo(_, id) {
  try {
    if (!id) {
      throw new CustomError("Video ID is required", 400);
    }

    try {
      // Create a fresh client instance for each request to avoid state issues
      const { Client } = require('youtubei');
      const freshClient = new Client();
      
      logger.fetch(`Fetching video with fresh client`, `Video: ${id}`);
      const video = await freshClient.getVideo(id);
      
      if (!video) {
        logger.error(`Video not found: ${id}`);
        throw new CustomError("Video not found or may have been removed", 404);
      }

      if (!video.id) {
        logger.error(`Invalid video data for ${id}`, JSON.stringify(video, null, 2));
        throw new CustomError("Unable to access video data - this may be due to regional restrictions or YouTube's security measures", 403);
      }

      return video;
    } catch (error) {
      // For parser errors (multiMarkersPlayerBarRenderer, etc.), try fallback
      if (error.message?.includes('Cannot read properties') || 
          error.message?.includes('undefined is not an object')) {
        logger.warn(`Parser error for ${id}, trying fallback`, error.message);
        return await fetchVideoFallback(id);
      }
      
      if (error.message?.includes('network') || error.message?.includes('timeout')) {
        logger.error(`Network error for ${id}`, error.message);
        throw new CustomError("Network error while accessing YouTube. Please try again later.", 503);
      }

      if (error instanceof CustomError) {
        throw error;
      }

      // For other errors, also try fallback
      logger.warn(`Unexpected error for ${id}, trying fallback`, error.message);
      return await fetchVideoFallback(id);
    }
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }
    throw new CustomError(error.message || "Failed to fetch video", error.statusCode || 500);
  }
}

async function tryGetTranscriptWithYoutubeTranscript(videoId) {
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    let text = '';
    transcript.forEach((entry) => {
      text += ' ' + entry.text;
    });
    return { success: true, content: text };
  } catch (error) {
    return { success: false, error };
  }
}

async function fetchTranscript(video) {
  if (!video || video.isLiveContent) {
    logger.info(`No transcript - Live content`, `Video: ${video?.id}`);
    return { available: false, reason: 'live_content' };
  }

  if (!video.captions) {
    logger.info(`No transcript - No captions`, `Video: ${video?.id}`);
    return { available: false, reason: 'no_captions' };
  }

  try {
    logger.fetch(`Transcript for ${video.id}`);
    
    // First try with YoutubeTranscript
    const ytTranscriptResult = await tryGetTranscriptWithYoutubeTranscript(video.id);
    if (ytTranscriptResult.success) {
      logger.success(`Got transcript for ${video.id} using YoutubeTranscript`);
      return { available: true, content: ytTranscriptResult.content };
    }

    // Fallback to video.captions.get()
    const transcript = await video.captions.get();
    logger.success(`Got transcript for ${video.id} using captions.get()`);
    return { available: true, content: transcript };
  } catch (error) {
    if (error.message?.includes('Transcript is disabled') || 
        error.message?.includes('Cannot read properties') ||
        error.name === 'YoutubeTranscriptDisabledError') {
      logger.info(`No transcript - Disabled`, `Video: ${video.id}`);
      return { available: false, reason: 'disabled' };
    }

    logger.warn(`Transcript fetch error for ${video.id}`, error.message);
    return { available: false, reason: 'error', error: error.message };
  }
}

async function fetchTimestampedTranscript(videoId) {
  try {
    // High-confidence languages for OpenAI extraction
    const highConfidenceLangs = ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'sv', 'da', 'fi', 'no'];

    let selectedLang = null;
    let availableLangCodes = [];
    let availableLanguages = [];

    // Get available languages first
    availableLanguages = await getTranscriptLanguages(videoId);
    if (availableLanguages.length > 0) {
      logger.info(`Available languages`, `Count: ${availableLanguages.length}`);
      // Try to extract language codes (support both string and object)
      availableLangCodes = availableLanguages.map(l => {
        if (typeof l === 'string') return l;
        if (l.languageCode) return l.languageCode;
        if (l.lang) return l.lang;
        if (l.code) return l.code;
        logger.warn(`Unexpected language format`, `Language: ${JSON.stringify(l)}`);
        return null;
      }).filter(Boolean); // Remove any null values

      logger.info(`Extracted language codes`, `Codes: ${availableLangCodes.join(', ')}`);
      
      // 1. Prefer English
      if (availableLangCodes.includes('en')) {
        selectedLang = 'en';
      } else {
        // 2. Try high-confidence languages
        const found = highConfidenceLangs.find(code => availableLangCodes.includes(code));
        if (found) {
          selectedLang = found;
        } else if (availableLangCodes.length === 1) {
          // 3. Only one language, use it
          selectedLang = availableLangCodes[0];
        } else if (availableLangCodes.length > 1) {
          // 4. Fallback: use the first available
          selectedLang = availableLangCodes[0];
        }
      }
      
      logger.info(`Selected language`, `Language: ${selectedLang}`);
    }

    const options = selectedLang ? { lang: selectedLang } : {};
    logger.fetch(`Fetching timestamped transcript`, `Video: ${videoId}${selectedLang ? ` | Language: ${selectedLang}` : ''}`);

    // Fetch transcript
    const transcript = await YoutubeTranscript.fetchTranscript(videoId, options);
    logger.info(`Raw transcript data`, `Length: ${transcript.length} entries`);
    
    // Format with proper line breaks
    let timestampedData = '';
    let regularData = '';
    let timestampedArray = [];
    
    transcript.forEach((entry) => {
      const timedString = `time: ${entry.offset} second. Text: ${entry.text}`;
      timestampedArray.push(timedString);
      regularData += ' ' + entry.text;
    });
    
    // Join with line breaks for better formatting
    timestampedData = timestampedArray.join('\n');
    
    timestampedData = decodeEntities(timestampedData);
    regularData = decodeEntities(regularData);

    logger.success(`Timestamped transcript fetched successfully`, `Video: ${videoId} | Length: ${timestampedData.length} chars`);
    
    return { 
      available: true, 
      content: timestampedData,
      content_array: timestampedArray.map(item => decodeEntities(item)), // Also provide as array
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
      videoCount: video.channel.videoCount,
      url: video.channel.url,
    } : null,
    title: video.title,
    chapters: video.chapters,
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