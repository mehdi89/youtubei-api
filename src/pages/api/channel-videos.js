import youtubei from "@/utils/youtubei";
import logger from "@/utils/logger";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    logger.error("Method not allowed", `Method: ${req.method}`);
    return res.status(405).end();
  }

  const youtube = youtubei;
  const { id, page } = req.body;
  const apiKey = req.headers['api-key'];

  if (apiKey !== process.env.YOUTUBE_API_KEY) {
    logger.error("Invalid API key");
    return res.status(401).json({ message: 'Please provide correct API key' });
  }

  if (!id) {
    logger.error("Missing channel ID");
    return res.status(400).json({ message: 'Channel ID is required' });
  }

  logger.fetch(`Fetching channel videos`, `Channel: ${id} | Page: ${page}`);

  try {
    let items = [];
    let newVideos = [];
    let channel = await youtube.findOne(id, { type: "channel" });

    // Check for error response from yt-dlp wrapper
    if (!channel || channel.error) {
      logger.error("Channel not found", `ID: ${id}`);
      return res.status(404).json({ message: "Channel not found" });
    }

    if (page > 1) {
      for (let i = 2; i <= page; i++) {
        try {
          logger.fetch(`Loading page ${i}`, `Channel: ${id}`);
          newVideos = await channel.videos.next(i);
        } catch (error) {
          logger.warn(`Failed to load page ${i}`, `Channel: ${id} | Error: ${error.message}`);
          return res.status(200).json(newVideos);
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
      // channel.videos is an object with items array, not a direct array
      const videoItems = channel.videos.items || [];
      items = videoItems.map(item => ({
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

    logger.success(`Found ${items.length} videos`, `Channel: ${id} | Page: ${page}`);
    return res.status(200).json(items);
  } catch (error) {
    logger.error(`Failed to fetch channel videos`, `Channel: ${id} | Error: ${error.message}`);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
