import youtubei from "@/utils/youtubei";
import logger from "@/utils/logger";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    logger.error("Method not allowed", `Method: ${req.method}`);
    return res.status(405).end();
  }

  const youtube = youtubei;
  const { id, page, tab = 'videos' } = req.body;
  const apiKey = req.headers['api-key'];

  if (apiKey !== process.env.YOUTUBE_API_KEY) {
    logger.error("Invalid API key");
    return res.status(401).json({ message: 'Please provide correct API key' });
  }

  if (!id) {
    logger.error("Missing channel ID");
    return res.status(400).json({ message: 'Channel ID is required' });
  }

  // Validate tab parameter
  const validTabs = ['videos', 'shorts', 'streams', 'playlists'];
  if (!validTabs.includes(tab)) {
    logger.error("Invalid tab parameter", `Tab: ${tab}`);
    return res.status(400).json({ message: `Invalid tab parameter. Must be one of: ${validTabs.join(', ')}` });
  }

  logger.fetch(`Fetching channel ${tab}`, `Channel: ${id} | Page: ${page} | Tab: ${tab}`);

  try {
    let items = [];
    let newContent = [];
    let channel = await youtube.findOne(id, { type: "channel" });

    if (!channel) {
      logger.error("Channel not found", `ID: ${id}`);
      return res.status(404).json({ message: "Channel not found" });
    }

    // Map tab to channel property and determine content source
    let contentSource;
    switch (tab) {
      case 'videos':
        contentSource = channel.videos;
        break;
      case 'shorts':
        contentSource = channel.shorts;
        // Note: YouTubei library v1.7.0 has a known issue with fetching shorts
        // See: https://github.com/SuspiciousLookingOwl/youtubei/issues/122
        logger.warn(`Shorts fetching may not work due to known library issue`);
        break;
      case 'streams':
        contentSource = channel.live;
        break;
      case 'playlists':
        contentSource = channel.playlists;
        // Note: YouTubei library v1.7.0 has a known issue with fetching playlists
        // See: https://github.com/SuspiciousLookingOwl/youtubei/issues/122
        logger.warn(`Playlists fetching may not work due to known library issue`);
        break;
      default:
        contentSource = channel.videos;
    }

    if (!contentSource) {
      logger.warn(`Content source not available for tab: ${tab}`);
      return res.status(200).json([]);
    }

    if (page > 1) {
      for (let i = 2; i <= page; i++) {
        try {
          logger.fetch(`Loading page ${i}`, `Channel: ${id} | Tab: ${tab}`);
          newContent = await contentSource.next(i);
        } catch (error) {
          logger.warn(`Failed to load page ${i}`, `Channel: ${id} | Tab: ${tab} | Error: ${error.message}`);
          return res.status(200).json(newContent);
        }
      }
    } else {
      newContent = await contentSource.next();
    }

    if (newContent && newContent.length > 0) {
      if (page === 2) {
        newContent = newContent.slice(30, 60);
      }
      // Handle different content types
      if (tab === 'playlists') {
        items = newContent.map(item => ({
          id: item?.id,
          title: item?.title,
          videoCount: item?.videoCount,
          thumbnail: item?.thumbnails?.[0]?.url || `https://img.youtube.com/vi/${item?.videos?.[0]?.id}/hqdefault.jpg`,
          channelName: item?.channel?.name,
          channelID: item?.channel?.id,
        }));
      } else {
        items = newContent.map(item => ({
          id: item?.id,
          title: item?.title,
          duration: item?.duration,
          description: item?.description,
          isLive: item?.isLive || (tab === 'streams'),
          viewCount: item?.viewCount,
          uploadDate: item?.uploadDate,
          thumbnail: `https://img.youtube.com/vi/${item?.id}/hqdefault.jpg`,
          channelName: item?.channel?.name,
          channelID: item?.channel?.id,
        }));
      }
    } else {
      // Handle initial content from the channel
      const initialContent = contentSource.items || contentSource;
      if (Array.isArray(initialContent) && tab === 'playlists') {
        items = initialContent.map(item => ({
          id: item?.id,
          title: item?.title,
          videoCount: item?.videoCount,
          thumbnail: item?.thumbnails?.[0]?.url || `https://img.youtube.com/vi/${item?.videos?.[0]?.id}/hqdefault.jpg`,
          channelName: item?.channel?.name,
          channelID: item?.channel?.id,
        }));
      } else if (Array.isArray(initialContent)) {
        items = initialContent.map(item => ({
          id: item?.id,
          title: item?.title,
          duration: item?.duration,
          description: item?.description,
          isLive: item?.isLive || (tab === 'streams'),
          viewCount: item?.viewCount,
          uploadDate: item?.uploadDate,
          thumbnail: `https://img.youtube.com/vi/${item?.id}/hqdefault.jpg`,
          channelName: item?.channel?.name,
          channelID: item?.channel?.id,
        }));
      }
    }

    // Add a note about shorts and playlists limitation if applicable
    if ((tab === 'shorts' || tab === 'playlists') && items.length === 0) {
      const contentType = tab === 'shorts' ? 'YouTube Shorts' : 'Playlists';
      logger.warn(`No ${tab} returned - this is a known limitation of youtubei v1.7.0`);
      return res.status(200).json({
        items: [],
        notice: `${contentType} fetching is currently not supported due to a known issue in the youtubei library (v1.7.0). See: https://github.com/SuspiciousLookingOwl/youtubei/issues/122`
      });
    }
    
    logger.success(`Found ${items.length} ${tab}`, `Channel: ${id} | Page: ${page} | Tab: ${tab}`);
    return res.status(200).json(items);
  } catch (error) {
    logger.error(`Failed to fetch channel ${tab}`, `Channel: ${id} | Tab: ${tab} | Error: ${error.message}`);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
