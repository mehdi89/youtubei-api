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
    const video = await youtube.getVideo(id);
    
    if (!video) {
      throw new CustomError("Video not found", 404);
    }

    if (!video.id) {
      console.error("Video object is missing ID property:", video);
      throw new CustomError("Invalid video data received", 500);
    }

    return video;
  } catch (error) {
    console.error("Error in fetchVideo:", error);
    if (error instanceof CustomError) {
      throw error;
    }
    throw new CustomError(`Error fetching video: ${error.message}`, error.statusCode || 500);
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