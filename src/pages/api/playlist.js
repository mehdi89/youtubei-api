import logger from "@/utils/logger";
import { getInnertube } from "@/utils/innertube";

/**
 * Playlist API
 * 
 * Fetches videos from a YouTube playlist.
 * 
 * @param {string} id - Playlist ID (required)
 * @param {number} page - Page number for pagination (default: 1)
 * 
 * New in v2:
 * - Playlist metadata included in response
 * - Better pagination handling
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    logger.error("Method not allowed", `Method: ${req.method}`);
    return res.status(405).end();
  }

  const { id, page = 1, includeMetadata = false } = req.body;
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
    const yt = await getInnertube();
    let playlist = await yt.getPlaylist(id);

    if (!playlist) {
      logger.error("Playlist not found", `ID: ${id}`);
      return res.status(404).json({ message: "Playlist not found" });
    }

    // Handle pagination
    if (page > 1) {
      for (let i = 2; i <= page; i++) {
        if (!playlist.has_continuation) {
          break;
        }
        try {
          logger.fetch(`Loading page ${i}`, `Playlist: ${id}`);
          playlist = await playlist.getContinuation();
        } catch (error) {
          logger.warn(`Failed to load page ${i}`, `Playlist: ${id} | Error: ${error.message}`);
          break;
        }
      }
    }

    // Format video items
    const videos = playlist.videos || playlist.items || [];
    const items = videos.map(item => formatPlaylistVideo(item));

    logger.success(`Found ${items.length} videos`, `Playlist: ${id} | Page: ${page}`);

    // Return with optional metadata
    if (includeMetadata) {
      return res.status(200).json({
        playlist: {
          id: playlist.info?.id || id,
          title: playlist.info?.title || null,
          description: playlist.info?.description || null,
          videoCount: playlist.info?.total_items || items.length,
          viewCount: parseCount(playlist.info?.views),
          lastUpdated: playlist.info?.last_updated || null,
          author: playlist.info?.author ? {
            name: playlist.info.author.name,
            id: playlist.info.author.id,
            thumbnail: playlist.info.author.thumbnails?.[0]?.url || null,
          } : null,
          thumbnail: playlist.info?.thumbnails?.[0]?.url || null,
        },
        videos: items,
        hasMore: playlist.has_continuation || false,
      });
    }

    // Backwards compatible: just return array of videos
    return res.status(200).json(items);
  } catch (error) {
    logger.error(`Failed to fetch playlist videos`, `Playlist: ${id} | Error: ${error.message}`);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

/**
 * Format a playlist video item
 */
function formatPlaylistVideo(item) {
  const videoId = item.id || item.video_id;
  
  return {
    id: videoId,
    title: item.title?.text || item.title || null,
    duration: parseDuration(item.duration),
    description: item.description?.text || item.description || null,
    isLive: item.is_live || false,
    viewCount: parseViewCount(item.view_count),
    uploadDate: item.published?.text || null,
    thumbnail: videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null,
    channelName: item.author?.name || null,
    channelID: item.author?.id || null,
    // Playlist-specific fields
    index: item.index || null,
    isPlayable: item.is_playable !== false,
  };
}

/**
 * Parse duration from various formats
 */
function parseDuration(duration) {
  if (!duration) return null;
  if (typeof duration === 'number') return duration;
  
  const durationText = duration.text || duration.toString();
  const parts = durationText.split(':').map(Number);
  
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  
  if (duration.seconds) return duration.seconds;
  return null;
}

/**
 * Parse view count from various formats
 */
function parseViewCount(viewCount) {
  if (!viewCount) return null;
  if (typeof viewCount === 'number') return viewCount;
  
  const text = (viewCount.text || viewCount).toString();
  return parseCount(text);
}

/**
 * Parse count from various formats
 */
function parseCount(countText) {
  if (!countText) return null;
  if (typeof countText === 'number') return countText;
  
  const text = countText.toString().replace(/[^0-9.KMB]/gi, '');
  const multipliers = { K: 1000, M: 1000000, B: 1000000000 };
  const match = text.match(/([0-9.]+)([KMB])?/i);
  
  if (match) {
    const num = parseFloat(match[1]);
    const multiplier = match[2] ? multipliers[match[2].toUpperCase()] : 1;
    return Math.round(num * multiplier);
  }
  
  return null;
}
