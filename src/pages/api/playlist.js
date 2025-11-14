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
    const playlist = await youtube.findOne(id, { type: "playlist" });

    // Check for error response from yt-dlp wrapper
    if (!playlist || playlist.error) {
      logger.error("Playlist not found", `ID: ${id}`);
      return res.status(404).json({ message: "Playlist not found" });
    }

    let videosToMap;
    
    if (page === 1) {
      // For page 1, use the already-loaded data
      videosToMap = playlist.videos.items || [];
    } else {
      // For page > 1, fetch the specific page
      try {
        logger.fetch(`Loading page ${page}`, `Playlist: ${id}`);
        videosToMap = await playlist.videos.next(page);
      } catch (error) {
        logger.warn(`Failed to load page ${page}`, `Playlist: ${id} | Error: ${error.message}`);
        return res.status(200).json([]);
      }
    }

    // Map the videos to the expected format
    items = videosToMap.map(item => ({
      id: item?.id,
      title: item?.title,
      duration: item?.duration,
      description: item?.description,
      isLive: item?.isLive,
      viewCount: item?.viewCount,
      uploadDate: item?.uploadDate,
      thumbnail: `https://img.youtube.com/vi/${item?.id}/hqdefault.jpg`,
      channelName: item?.channelName || item?.channel?.name,
      channelID: item?.channelID || item?.channel?.id,
    }));

    logger.success(`Found ${items.length} videos`, `Playlist: ${id} | Page: ${page}`);
    return res.status(200).json(items);
  } catch (error) {
    logger.error(`Failed to fetch playlist videos`, `Playlist: ${id} | Error: ${error.message}`);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
