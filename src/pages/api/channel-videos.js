import logger from "@/utils/logger";
import { getInnertube } from "@/utils/innertube";

/**
 * Channel Videos API
 * 
 * Fetches videos from a YouTube channel with support for content type filtering.
 * 
 * @param {string} id - Channel ID (required)
 * @param {number} page - Page number for pagination (default: 1)
 * @param {string} contentType - Content type filter: "videos" | "shorts" | "live" | "all" (default: "all")
 * 
 * New in v2:
 * - contentType parameter to filter by content type
 * - isShort field in response to identify Shorts
 * - Separate API calls for better accuracy
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    logger.error("Method not allowed", `Method: ${req.method}`);
    return res.status(405).end();
  }

  const { id, page = 1, contentType = "all" } = req.body;
  const apiKey = req.headers['api-key'];

  if (apiKey !== process.env.YOUTUBE_API_KEY) {
    logger.error("Invalid API key");
    return res.status(401).json({ message: 'Please provide correct API key' });
  }

  if (!id) {
    logger.error("Missing channel ID");
    return res.status(400).json({ message: 'Channel ID is required' });
  }

  // Validate contentType
  const validContentTypes = ['all', 'videos', 'shorts', 'live'];
  if (!validContentTypes.includes(contentType)) {
    logger.error("Invalid contentType", `Got: ${contentType}`);
    return res.status(400).json({ 
      message: `Invalid contentType. Must be one of: ${validContentTypes.join(', ')}` 
    });
  }

  logger.fetch(`Fetching channel ${contentType}`, `Channel: ${id} | Page: ${page}`);

  try {
    const yt = await getInnertube();
    const channel = await yt.getChannel(id);

    if (!channel) {
      logger.error("Channel not found", `ID: ${id}`);
      return res.status(404).json({ message: "Channel not found" });
    }

    let items = [];

    if (contentType === 'all') {
      // Backwards compatible: fetch all content types and merge
      const [videosResult, shortsResult] = await Promise.all([
        fetchContentTab(channel, 'videos', page),
        fetchContentTab(channel, 'shorts', page),
      ]);
      
      items = [
        ...videosResult.map(v => ({ ...v, isShort: false })),
        ...shortsResult.map(v => ({ ...v, isShort: true })),
      ];
      
      // Sort by upload date (most recent first) if available
      items.sort((a, b) => {
        if (!a.uploadDate || !b.uploadDate) return 0;
        return new Date(b.uploadDate) - new Date(a.uploadDate);
      });
    } else {
      // Specific content type
      const isShort = contentType === 'shorts';
      items = await fetchContentTab(channel, contentType, page);
      items = items.map(v => ({ ...v, isShort }));
    }

    logger.success(`Found ${items.length} ${contentType}`, `Channel: ${id} | Page: ${page}`);
    return res.status(200).json(items);
  } catch (error) {
    logger.error(`Failed to fetch channel ${contentType}`, `Channel: ${id} | Error: ${error.message}`);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

/**
 * Fetch content from a specific channel tab
 */
async function fetchContentTab(channel, contentType, page) {
  try {
    let tab;
    
    // Get the appropriate tab
    switch (contentType) {
      case 'videos':
        tab = await channel.getVideos();
        break;
      case 'shorts':
        tab = await channel.getShorts();
        break;
      case 'live':
        tab = await channel.getLiveStreams();
        break;
      default:
        tab = await channel.getVideos();
    }

    if (!tab || !tab.videos) {
      return [];
    }

    // Handle pagination
    let videos = tab.videos;
    
    if (page > 1) {
      let currentTab = tab;
      for (let i = 2; i <= page; i++) {
        if (!currentTab.has_continuation) {
          break;
        }
        try {
          logger.fetch(`Loading ${contentType} page ${i}`, `Channel: ${channel.metadata?.external_id}`);
          currentTab = await currentTab.getContinuation();
          videos = currentTab.videos || [];
        } catch (error) {
          logger.warn(`Failed to load ${contentType} page ${i}`, error.message);
          break;
        }
      }
    }

    // Map to response format
    return videos.map(item => formatVideoItem(item, channel));
  } catch (error) {
    logger.warn(`Failed to fetch ${contentType} tab`, error.message);
    return [];
  }
}

/**
 * Format a video item for the API response
 * Handles both regular videos and Shorts (which have different structures)
 */
function formatVideoItem(item, channel) {
  // Handle Shorts (ShortsLockupView type)
  if (item.type === 'ShortsLockupView') {
    const videoId = item.on_tap_endpoint?.payload?.videoId || 
                    item.entity_id?.replace('shorts-shelf-item-', '') ||
                    null;
    
    // Parse title and views from accessibility_text
    // Format: "Title, X views - play Short"
    let title = null;
    let viewCount = null;
    
    if (item.accessibility_text) {
      const accessText = item.accessibility_text;
      // Extract title (everything before the last comma + views info)
      const viewsMatch = accessText.match(/,\s*([\d.]+\s*(?:thousand|million|billion|K|M|B)?)\s*views?\s*-\s*play\s*Short$/i);
      if (viewsMatch) {
        title = accessText.slice(0, accessText.lastIndexOf(viewsMatch[0])).trim();
        viewCount = parseViewCount(viewsMatch[1]);
      } else {
        // Fallback: just remove " - play Short" suffix
        title = accessText.replace(/\s*-\s*play\s*Short$/i, '').trim();
      }
    }
    
    return {
      id: videoId,
      title: title,
      duration: null, // Shorts don't expose duration in listing
      description: null,
      isLive: false,
      viewCount: viewCount,
      uploadDate: null,
      thumbnail: videoId ? `https://i.ytimg.com/vi/${videoId}/hq720.jpg` : null,
      channelName: channel.metadata?.title || null,
      channelID: channel.metadata?.external_id || null,
    };
  }
  
  // Handle regular videos (Video, GridVideo, etc.)
  const videoId = item.id || item.video_id;
  const duration = parseDuration(item.duration);
  
  return {
    id: videoId,
    title: item.title?.text || item.title || null,
    duration: duration,
    description: item.description?.text || item.description || null,
    isLive: item.is_live || item.isLive || false,
    viewCount: parseViewCount(item.view_count || item.views || item.viewCount),
    uploadDate: item.published?.text || item.uploadDate || null,
    thumbnail: videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null,
    channelName: channel.metadata?.title || item.channel?.name || null,
    channelID: channel.metadata?.external_id || item.channel?.id || null,
  };
}

/**
 * Parse duration from various formats
 */
function parseDuration(duration) {
  if (!duration) return null;
  
  // If it's already a number, return it
  if (typeof duration === 'number') return duration;
  
  // If it's a string like "10:30" or "1:30:45"
  if (typeof duration === 'string') {
    // Handle text property
    const durationText = duration.text || duration;
    
    const parts = durationText.split(':').map(Number);
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
  }
  
  // If duration has a seconds property
  if (duration.seconds) return duration.seconds;
  
  return null;
}

/**
 * Parse view count from various formats
 */
function parseViewCount(viewCount) {
  if (!viewCount) return null;
  
  // If it's already a number
  if (typeof viewCount === 'number') return viewCount;
  
  // If it's a string like "1.5M views" or "1,234,567 views"
  if (typeof viewCount === 'string') {
    const text = viewCount.text || viewCount;
    const cleaned = text.replace(/[^0-9.KMB]/gi, '');
    
    const multipliers = { K: 1000, M: 1000000, B: 1000000000 };
    const match = cleaned.match(/([0-9.]+)([KMB])?/i);
    
    if (match) {
      const num = parseFloat(match[1]);
      const multiplier = match[2] ? multipliers[match[2].toUpperCase()] : 1;
      return Math.round(num * multiplier);
    }
  }
  
  // If viewCount has a text property
  if (viewCount.text) {
    return parseViewCount(viewCount.text);
  }
  
  return null;
}
