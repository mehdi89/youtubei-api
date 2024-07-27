import { Client } from "youtubei";
export default async function handler(req, res) {
  if (req.method === "POST") {
    const youtube = new Client();
    const { id } = req.body;
    const apiKey = req.headers["api-key"];
    if (apiKey != "S#D$FG%^$#DEF%G^*$%R^T&Y*U") {
      res.status(401).json({ message: "Please provide correct api key" });
    }
    try {
      var video = await youtube.getVideo(id);
      console.log(video?.channel);
      let response = {
        id: video?.id,
        channel: {
          youtube_channel_id: video?.channel?.id,
          name: video?.channel?.name,
          subscriberCount: video?.channel?.subscriberCount,
          thumbnails: video?.channel?.thumbnails,
          videoCount: video?.channel?.videoCount,
          url: video?.channel?.url,
        },
        title: video?.title,
        chapters: video?.chapters,
        //   'comments':video?.comments,
        description: video?.description,
        duration: video?.duration,
        likeCount: video?.likeCount,
        isLiveContent: video?.isLiveContent,
        uploadDate: video?.uploadDate,
        viewCount: video?.viewCount,
        transcript: video?.getTranscript(id),
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
