import youtubei from "@/utils/youtubei";

export default async function handler(req, res) {
  if (req.method === "POST") {
    const youtube = youtubei;
    const { id, page } = req.body;
    const apiKey = req.headers['api-key'];

    if (apiKey !== 'S#D$FG%^$#DEF%G^*$%R^T&Y*U') {
      return res.status(401).json({ message: 'Please provide correct API key' });
    }
    console.log(`Fetching channel videos with ID: ${id}`);
    try {
      var items = [];
      var newVideos = [];
      var channel = await youtube.findOne(id, { type: "channel" });

      if (!channel) {
        return res.status(404).json({ message: "Channel not found" });
      }

      if (page > 1) {
        for (var i = 2; i <= page; i++) {
          try {
            newVideos = await channel.videos.next(i);
          } catch (error) {
            console.error("Error fetching additional videos:", error);
            return res.status(500).json({ message: "Error fetching additional videos" });
          }
        }
      } else {
        newVideos = await channel.videos.next();
      }

      if (newVideos && newVideos.length > 0) {
        if (page === 2) {
          newVideos = newVideos.slice(30, 60);
        }
        items = newVideos.map(item => ({
          id: item?.id,
          title: item?.title,
          duration: item?.duration,
          description: item?.description,
          isLive: item?.isLive,
          viewCount: item?.viewCount,
          uploadDate: item?.uploadDate,
          thumbnail: `https://img.youtube.com/vi/${item?.id}/hqdefault.jpg`,
          channelName: item?.channel?.name,
          channelID: item?.channel?.id,
        }));
      } else {
        items = channel.videos.map(item => ({
          id: item?.id,
          title: item?.title,
          duration: item?.duration,
          description: item?.description,
          isLive: item?.isLive,
          viewCount: item?.viewCount,
          uploadDate: item?.uploadDate,
          thumbnail: `https://img.youtube.com/vi/${item?.id}/hqdefault.jpg`,
          channelName: item?.channel?.name,
          channelID: item?.channel?.id,
        }));
      }

      return res.status(200).json(items);
    } catch (error) {
      console.error("Error fetching channel data:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  } else {
    return res.status(405).end();
  }
}
