import youtubei from "@/utils/youtubei";

const API_KEY = "S#D$FG%^$#DEF%G^*$%R^T&Y*U";

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
  if (video.isLiveContent) {
    console.warn(`Live video does not have a transcript: ${video.id}`);
    return '';
  }

  if (!video.captions) {
    console.warn(`Transcript not available for video: ${video.id}`);
    return '';
  }

  try {
    console.info(`Fetching transcript for video: ${video.id}`);
    return await video.captions.get();
  } catch (error) {
    console.error("Error fetching transcript:", error);
    return '';
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
    response.transcript = transcript;
  }

  return response;
}

class CustomError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}