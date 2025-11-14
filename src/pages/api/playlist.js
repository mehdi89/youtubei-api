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
    logger.error("Missing playlist ID");
    return res.status(400).json({ message: 'Playlist ID is required' });
  }

  logger.fetch(`Fetching playlist videos`, `Playlist: ${id} | Page: ${page}`);

  try {
    let items = [];
    let newVideos = [];
    const playlist = await youtube.findOne(id, { type: "playlist" });

    // Check for error response from yt-dlp wrapper
    if (!playlist || playlist.error) {
      logger.error("Playlist not found", `ID: ${id}`);
      return res.status(404).json({ message: "Playlist not found" });
    }

    if (page > 1) {
      for (let i = 2; i <= page; i++) {
        try {
          logger.fetch(`Loading page ${i}`, `Playlist: ${id}`);
          newVideos = await playlist.videos.next(i);
        } catch (error) {
          logger.warn(`Failed to load page ${i}`, `Playlist: ${id} | Error: ${error.message}`);
          return res.status(200).json(newVideos);
        }
      }
    } else {
      newVideos = await playlist.videos.next();
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
      // playlist.videos is an object with items array, not a direct array
      const videoItems = playlist.videos.items || [];
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

    logger.success(`Found ${items.length} videos`, `Playlist: ${id} | Page: ${page}`);
    return res.status(200).json(items);
  } catch (error) {
    logger.error(`Failed to fetch playlist videos`, `Playlist: ${id} | Error: ${error.message}`);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
