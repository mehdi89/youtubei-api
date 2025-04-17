import youtubei from "@/utils/youtubei";
import logger from "@/utils/logger";
import { YoutubeTranscript } from 'youtube-transcript';

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

  const { id, transcript: includeTranscript = true } = req.body;
  if (!id) {
    return res.status(400).json({ message: "Missing video ID" });
  }

  const youtube = youtubei;

  try {
    logger.fetch(`Video ${id}`);
    const video = await fetchVideo(youtube, id);
    
    let transcript = '';
    if (includeTranscript) {
      transcript = await fetchTranscript(video);
    }

    const response = formatResponse(video, transcript, includeTranscript);
    logger.success(`Processed video ${id}`, `Title: ${video.title}`);
    res.status(200).json(response);
  } catch (error) {
    logger.error(`Failed to process video ${id}`, error.message);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function fetchVideo(youtube, id) {
  try {
    if (!id) {
      throw new CustomError("Video ID is required", 400);
    }

    try {
      const video = await youtube.getVideo(id);
      
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
      // Handle specific error cases
      if (error.message?.includes('videoId')) {
        logger.error(`API access error for ${id}`, error.message);
        throw new CustomError("Unable to access YouTube data. This could be due to API restrictions or rate limiting.", 429);
      }
      
      if (error.message?.includes('network') || error.message?.includes('timeout')) {
        logger.error(`Network error for ${id}`, error.message);
        throw new CustomError("Network error while accessing YouTube. Please try again later.", 503);
      }

      if (error instanceof CustomError) {
        throw error;
      }

      logger.error(`Unexpected error for ${id}`, error.message);
      throw new CustomError("An unexpected error occurred while fetching the video", 500);
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

function formatResponse(video, transcript, includeTranscript) {
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

  return response;
}

class CustomError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}