import youtubei from "@/utils/youtubei";

// Get API key from environment variables
const API_KEY = process.env.YOUTUBE_API_KEY;

if (!API_KEY) {
  console.error("YOUTUBE_API_KEY environment variable is not set!");
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
    console.log(`Fetching video with ID: ${id}`);
    const video = await fetchVideo(youtube, id);
    
    let transcript = '';
    if (includeTranscript) {
      transcript = await fetchTranscript(video);
    }

    const response = formatResponse(video, transcript, includeTranscript);
    res.status(200).json(response);
  } catch (error) {
    console.error("Error in handler:", error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function fetchVideo(youtube, id) {
  try {
    if (!id) {
      throw new CustomError("Video ID is required", 400);
    }

    console.log(`Attempting to fetch video with ID: ${id}`);
    
    try {
      const video = await youtube.getVideo(id);
      
      if (!video) {
        console.error(`Video not found for ID: ${id}`);
        throw new CustomError("Video not found or may have been removed", 404);
      }

      if (!video.id) {
        console.error("Received invalid video data:", JSON.stringify(video, null, 2));
        throw new CustomError("Unable to access video data - this may be due to regional restrictions or YouTube's security measures", 403);
      }

      return video;
    } catch (error) {
      // Handle specific error cases
      if (error.message?.includes('videoId')) {
        console.error(`YouTube API access error for video ${id}:`, error.message);
        throw new CustomError("Unable to access YouTube data. This could be due to API restrictions or rate limiting.", 429);
      }
      
      if (error.message?.includes('network') || error.message?.includes('timeout')) {
        console.error(`Network error while fetching video ${id}:`, error.message);
        throw new CustomError("Network error while accessing YouTube. Please try again later.", 503);
      }

      // If it's already our custom error, just rethrow it
      if (error instanceof CustomError) {
        throw error;
      }

      // For any other unexpected errors
      console.error(`Unexpected error while fetching video ${id}:`, error);
      throw new CustomError("An unexpected error occurred while fetching the video", 500);
    }
  } catch (error) {
    // Ensure we always return a proper error response
    if (error instanceof CustomError) {
      throw error;
    }
    throw new CustomError(error.message || "Failed to fetch video", error.statusCode || 500);
  }
}

async function fetchTranscript(video) {
  // Early returns for cases where transcript is not available
  if (!video || video.isLiveContent) {
    console.info(`Transcript not available - Live content: ${video?.id}`);
    return { available: false, reason: 'live_content' };
  }

  if (!video.captions) {
    console.info(`Transcript not available - No captions: ${video?.id}`);
    return { available: false, reason: 'no_captions' };
  }

  try {
    console.info(`Fetching transcript for video: ${video.id}`);
    const transcript = await video.captions.get();
    return { available: true, content: transcript };
  } catch (error) {
    // Log but don't treat as error - transcript unavailability is an expected state
    if (error.message?.includes('Transcript is disabled') || 
        error.message?.includes('Cannot read properties') ||
        error.name === 'YoutubeTranscriptDisabledError') {
      console.info(`Transcript not available - Disabled: ${video.id}`);
      return { available: false, reason: 'disabled' };
    }

    // For unexpected errors, log but don't throw
    console.warn(`Unexpected error fetching transcript for ${video.id}:`, error.message);
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