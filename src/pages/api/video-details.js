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
      const video = await youtube.getVideo(id);

      if (!video || !video.id) {
        return res.status(404).json({ message: "Video not found or invalid video ID" });
      }

      let transcript = null;
      try {
        transcript = await video.getTranscript();
      } catch (transcriptError) {
        console.error("Error fetching transcript:", transcriptError);
      }

      const response = {
        id: video.id,
        channel: {
          youtube_channel_id: video.channel?.id,
          name: video.channel?.name,
          subscriberCount: video.channel?.subscriberCount,
          thumbnails: video.channel?.thumbnails,
          videoCount: video.channel?.videoCount,
          url: video.channel?.url,
        },
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
      console.error("Error fetching video data:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  } else {
    res.status(405).end();
  }
}
