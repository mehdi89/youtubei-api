import logger from "@/utils/logger";
import cache, { TTL } from '@/utils/cache';
import { cacheGet, cacheSet } from '@/utils/redis-cache';
import { getInnertube, resolveChannelId, isChannelNotFoundError, normalizeLockup } from "@/utils/innertube";

/**
 * Channel Live Videos API
 * 
 * Fetches live streams from a YouTube channel.
 * 
 * @param {string} id - Channel ID (required)
 * @param {number} page - Page number for pagination (default: 1)
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    logger.error("Method not allowed", `Method: ${req.method}`);
    return res.status(405).end();
  }

  const { id, page = 1 } = req.body;
  const apiKey = req.headers['api-key'];

  if (apiKey !== process.env.YOUTUBE_API_KEY) {
    logger.error("Invalid API key");
    return res.status(401).json({ message: 'Please provide correct API key' });
  }

  if (!id) {
    logger.error("Missing channel ID");
    return res.status(400).json({ message: 'Channel ID is required' });
  }

  // Check cache first
  const cacheKey = cache.generateKey('channel-live', { id, page });
  const cached = await cacheGet(cacheKey);
  if (cached) {
    logger.info(`Cache hit for channel live ${id}`);
    return res.status(200).json(cached);
  }

  try {
    const yt = await getInnertube();

    // Resolve handle/URL to channel ID if needed
    let channelId = id;
    if (!id.startsWith('UC') || id.length !== 24) {
      logger.fetch(`Resolving channel identifier`, `Input: ${id}`);
      channelId = await resolveChannelId(yt, id);
      logger.info(`Resolved to channel ID: ${channelId}`);
    }

    logger.fetch(`Fetching live videos`, `Channel: ${channelId}`);

    const channel = await yt.getChannel(channelId);

    if (!channel) {
      logger.error("Channel not found", `ID: ${id}`);
      return res.status(404).json({ message: "Channel not found" });
    }

    // Get live streams tab
    let liveTab;
    try {
      liveTab = await channel.getLiveStreams();
    } catch (e) {
      // Channel might not have a live tab
      logger.info(`No live streams tab`, `Channel: ${id}`);
      return res.status(200).json([]);
    }

    if (!liveTab || !liveTab.videos) {
      logger.info(`No live videos found`, `Channel: ${id}`);
      return res.status(200).json([]);
    }

    // Handle pagination
    let videos = liveTab.videos;
    
    if (page > 1) {
      let currentTab = liveTab;
      for (let i = 2; i <= page; i++) {
        if (!currentTab.has_continuation) {
          break;
        }
        try {
          logger.fetch(`Loading page ${i}`, `Channel: ${id}`);
          currentTab = await currentTab.getContinuation();
          videos = currentTab.videos || [];
        } catch (error) {
          logger.warn(`Failed to load page ${i}`, error.message);
          break;
        }
      }
    }

    const items = videos.map(item => formatLiveVideo(item, channel));

    logger.success(`Found ${items.length} live videos`, `Channel: ${id}`);

    // Cache the response
    await cacheSet(cacheKey, items, TTL.CHANNEL_LIVE);

    return res.status(200).json(items);
  } catch (error) {
    if (isChannelNotFoundError(error)) {
      logger.warn(`Channel not found`, `Channel: ${id} | ${error.message}`);
      return res.status(404).json({ message: "Channel not found" });
    }
    logger.error(`Failed to fetch live videos`, `Channel: ${id} | Error: ${error.message}`);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

/**
 * Format a live video item
 */
function formatLiveVideo(item, channel) {
  item = normalizeLockup(item);
  const videoId = item.id || item.video_id;
  
  return {
    id: videoId,
    title: item.title?.text || item.title || null,
    duration: item.is_live ? null : parseDuration(item.duration),
    description: item.description?.text || item.description || null,
    isLive: Boolean(item.is_live),
    viewCount: parseViewCount(item.view_count),
    uploadDate: item.published?.text || null,
    thumbnail: videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null,
    channelName: channel.metadata?.title || item.channel?.name || null,
    channelID: channel.metadata?.external_id || item.channel?.id || null,
    // Live-specific fields
    watchingCount: parseViewCount(item.view_count), // For live, this is concurrent viewers
    scheduledTime: item.upcoming?.text || null,
    isUpcoming: item.is_upcoming || false,
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
  
  return null;
}

/**
 * Parse view count from various formats
 */
function parseViewCount(viewCount) {
  if (!viewCount) return null;
  if (typeof viewCount === 'number') return viewCount;
  
  const text = (viewCount.text || viewCount).toString();
  const cleaned = text.replace(/[^0-9.KMB]/gi, '');
  
  const multipliers = { K: 1000, M: 1000000, B: 1000000000 };
  const match = cleaned.match(/([0-9.]+)([KMB])?/i);
  
  if (match) {
    const num = parseFloat(match[1]);
    const multiplier = match[2] ? multipliers[match[2].toUpperCase()] : 1;
    return Math.round(num * multiplier);
  }
  
  return null;
}
