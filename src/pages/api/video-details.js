import { Client } from "youtubei";

export default async function handler(req, res) {
  if (req.method === "POST") {
    const youtube = new Client();
    const { id } = req.body;
    const apiKey = req.headers["api-key"];
    
    if (apiKey !== "S#D$FG%^$#DEF%G^*$%R^T&Y*U") {
      return res.status(401).json({ message: "Please provide the correct API key" });
    }

    try {
      console.log("Fetching video with ID:", id);
      let video;
      try {
        video = await youtube.getVideo(id);
      } catch (videoError) {
        console.error("Error fetching video:", videoError);
        return res.status(404).json({ message: "Error fetching video", error: videoError.message });
      }

      if (!video || !video.id) {
        return res.status(404).json({ message: "Video not found or invalid video ID" });
      }

      console.log("Video data:", video);

      let transcript = null;
      try {
        transcript = await video.getTranscript();
      } catch (transcriptError) {
        console.error("Error fetching transcript:", transcriptError);
        // Don't return here, continue with the rest of the video data
      }

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
        transcript: transcript,
      };

      res.status(200).json(response);
    } catch (error) {
      console.error("Error in handler:", error);
      res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
  } else {
    res.status(405).end();
  }
}