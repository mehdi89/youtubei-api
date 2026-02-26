import logger from "@/utils/logger";
import cache, { TTL } from '@/utils/cache';
import { cacheGet, cacheSet } from '@/utils/redis-cache';
import { getInnertube } from "@/utils/innertube";

/**
 * Search API
 * 
 * Searches YouTube for videos, channels, or playlists.
 * 
 * @param {string} query - Search query (required)
 * @param {string} type - Content type: "video" | "channel" | "playlist" (required)
 * @param {number} page - Page number for pagination (default: 1)
 * @param {string} sortBy - Sort order: "relevance" | "date" | "views" | "rating" (default: "relevance")
 * @param {string} duration - Duration filter: "short" | "medium" | "long" (video only)
 * @param {string} uploadDate - Upload date filter: "hour" | "day" | "week" | "month" | "year" (video only)
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    logger.error("Method not allowed", `Method: ${req.method}`);
    return res.status(405).end();
  }

  const { 
    query, 
    type, 
    page = 1,
    sortBy = "relevance",
    duration,
    uploadDate
  } = req.body;
  const apiKey = req.headers['api-key'];

  if (apiKey !== process.env.YOUTUBE_API_KEY) {
    logger.error("Invalid API key");
    return res.status(401).json({ message: 'Please provide correct API key' });
  }

  if (!query) {
    logger.error("Missing search query");
    return res.status(400).json({ message: 'Search query is required' });
  }

  const validTypes = ['video', 'channel', 'playlist'];
  if (!type || !validTypes.includes(type)) {
    logger.error("Invalid search type", `Type: ${type}`);
    return res.status(400).json({
      message: `Invalid search type. Must be one of: ${validTypes.join(', ')}`
    });
  }

  // Check cache first
  const cacheKey = cache.generateKey('search', { query, type, page, sortBy, duration, uploadDate });
  const cached = await cacheGet(cacheKey);
  if (cached) {
    logger.info(`Cache hit for search "${query}"`);
    return res.status(200).json(cached);
  }

  logger.fetch(`Searching ${type}`, `Query: "${query}" | Page: ${page}`);

  try {
    const yt = await getInnertube();
    
    // Build search options
    const searchOptions = {
      type: type,
    };
    
    // Add filters for video searches
    if (type === 'video') {
      if (sortBy && sortBy !== 'relevance') {
        searchOptions.sort_by = mapSortBy(sortBy);
      }
      if (duration) {
        searchOptions.duration = mapDuration(duration);
      }
      if (uploadDate) {
        searchOptions.upload_date = mapUploadDate(uploadDate);
      }
    }

    // Execute search
    let search = await yt.search(query, searchOptions);

    if (!search || !search.results || search.results.length === 0) {
      logger.info("No results found", `Type: ${type} | Query: "${query}"`);
      return res.status(404).json({ message: 'No results found' });
    }

    // Handle pagination
    if (page > 1) {
      for (let i = 2; i <= page; i++) {
        if (!search.has_continuation) {
          break;
        }
        try {
          logger.fetch(`Loading page ${i}`, `Type: ${type} | Query: "${query}"`);
          search = await search.getContinuation();
        } catch (error) {
          logger.warn(`Failed to load page ${i}`, error.message);
          break;
        }
      }
    }

    // Format results based on type
    let items = [];
    const results = search.results || [];

    switch (type) {
      case "video":
        items = results
          .filter(item => item.type === 'Video')
          .map(formatVideoResult);
        break;

      case "channel":
        items = results
          .filter(item => item.type === 'Channel')
          .map(formatChannelResult);
        break;

      case "playlist":
        items = results
          .filter(item => item.type === 'Playlist')
          .map(formatPlaylistResult);
        break;
    }

    logger.success(`Found ${items.length} ${type}s`, `Query: "${query}" | Page: ${page}`);

    // Cache the response
    await cacheSet(cacheKey, items, TTL.SEARCH);

    res.status(200).json(items);
  } catch (error) {
    logger.error("Search failed", `Error: ${error.message}`);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

/**
 * Format video search result
 */
function formatVideoResult(item) {
  const videoId = item.id || item.video_id;
  return {
    id: videoId,
    title: item.title?.text || item.title || null,
    duration: parseDuration(item.duration),
    description: item.description_snippet?.text || item.description || null,
    isLive: item.is_live || false,
    viewCount: parseViewCount(item.view_count || item.short_view_count),
    uploadDate: item.published?.text || null,
    thumbnail: videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null,
    channelName: item.author?.name || null,
    channelID: item.author?.id || null,
    channelThumbnail: item.author?.thumbnails?.[0]?.url || null,
    // New fields
    isShort: item.is_shorts || false,
    badges: item.badges?.map(b => b.label || b.text)?.filter(Boolean) || [],
  };
}

/**
 * Format channel search result
 */
function formatChannelResult(item) {
  // Get best thumbnail
  let thumbnail = null;
  if (item.author?.thumbnails?.length > 0) {
    const thumbs = item.author.thumbnails;
    thumbnail = thumbs[thumbs.length - 1]?.url || thumbs[0]?.url;
  }

  return {
    id: item.author?.id || item.id || null,
    title: item.author?.name || item.name || null,
    description: item.description_snippet?.text || item.description || null,
    videoCount: parseCount(item.video_count),
    subscriberCount: item.subscriber_count?.text || item.subscriberCount || null,
    thumbnail: thumbnail,
    // New fields
    handle: item.author?.url?.includes('@') ? item.author.url.split('/').pop() : null,
    isVerified: item.author?.is_verified || false,
  };
}

/**
 * Format playlist search result
 */
function formatPlaylistResult(item) {
  return {
    id: item.id || null,
    title: item.title?.text || item.title || null,
    videoCount: item.video_count?.text ? parseCount(item.video_count.text) : item.videoCount,
    thumbnail: item.thumbnails?.[0]?.url || null,
    channelName: item.author?.name || null,
    channelID: item.author?.id || null,
    // New fields
    description: item.first_videos?.map(v => v.title?.text).join(', ') || null,
  };
}

/**
 * Map sort_by parameter to youtubei.js format
 */
function mapSortBy(sortBy) {
  const mapping = {
    'relevance': 'relevance',
    'date': 'upload_date',
    'views': 'view_count',
    'rating': 'rating',
  };
  return mapping[sortBy] || 'relevance';
}

/**
 * Map duration filter
 */
function mapDuration(duration) {
  const mapping = {
    'short': 'short',      // Under 4 minutes
    'medium': 'medium',    // 4-20 minutes
    'long': 'long',        // Over 20 minutes
  };
  return mapping[duration];
}

/**
 * Map upload date filter
 */
function mapUploadDate(uploadDate) {
  const mapping = {
    'hour': 'last_hour',
    'day': 'today',
    'week': 'this_week',
    'month': 'this_month',
    'year': 'this_year',
  };
  return mapping[uploadDate];
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
