import logger from "@/utils/logger";
import { getInnertube } from "@/utils/innertube";

/**
 * Channel Details API
 * 
 * Fetches detailed information about a YouTube channel.
 * 
 * @param {string} id - Channel ID (required)
 * 
 * New in v2:
 * - More reliable data extraction
 * - Additional fields: handle, tags, videoCount, shortsCount
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    logger.error("Method not allowed", `Method: ${req.method}`);
    return res.status(405).end();
  }

  const { id } = req.body;
  const apiKey = req.headers['api-key'];

  if (apiKey !== process.env.YOUTUBE_API_KEY) {
    logger.error("Invalid API key");
    return res.status(401).json({ message: 'Please provide correct API key' });
  }

  if (!id) {
    logger.error("Missing channel ID");
    return res.status(400).json({ message: 'Channel ID is required' });
  }

  logger.fetch(`Fetching channel details`, `Channel: ${id}`);

  try {
    const yt = await getInnertube();
    const channel = await yt.getChannel(id);

    if (!channel) {
      logger.error("Channel not found", `ID: ${id}`);
      return res.status(404).json({ message: "Channel not found" });
    }

    const metadata = channel.metadata;
    const header = channel.header;
    const headerContent = header?.content;
    
    // Parse metadata from header rows (new structure)
    // Row 0: handle (@ChannelName)
    // Row 1: subscriber count, video count
    const metadataRows = headerContent?.metadata?.metadata_rows || [];
    
    let handle = null;
    let subscriberCount = null;
    let videosCount = null;
    
    // Extract handle from first row
    if (metadataRows[0]?.metadata_parts?.[0]?.text?.text) {
      const handleText = metadataRows[0].metadata_parts[0].text.text;
      if (handleText.startsWith('@')) {
        handle = handleText;
      }
    }
    
    // Extract subscriber count and video count from second row
    if (metadataRows[1]?.metadata_parts) {
      for (const part of metadataRows[1].metadata_parts) {
        const text = part.text?.text || '';
        if (text.includes('subscriber')) {
          subscriberCount = text;
        } else if (text.includes('video')) {
          videosCount = parseCount(text);
        }
      }
    }
    
    // Fallback to metadata object
    if (!subscriberCount && metadata?.subscriber_count) {
      subscriberCount = metadata.subscriber_count;
    }
    if (!videosCount && metadata?.video_count) {
      videosCount = metadata.video_count;
    }

    // Extract banner image
    let banner = null;
    const bannerImages = headerContent?.banner?.image || header?.banner;
    if (bannerImages?.length > 0) {
      // Get highest resolution banner
      banner = bannerImages[0]?.url || null;
    }

    // Extract thumbnail/avatar
    let thumbnail = null;
    const avatarImages = headerContent?.image?.avatar?.image || metadata?.avatar;
    if (avatarImages?.length > 0) {
      // Get highest resolution avatar
      thumbnail = avatarImages[0]?.url || null;
    }
    
    // Check for verification badge
    let isVerified = false;
    const titleRuns = headerContent?.title?.text?.runs || [];
    for (const run of titleRuns) {
      if (run.attachment?.element?.type?.imageType?.image?.sources?.[0]?.clientResource?.imageName === 'CHECK_CIRCLE_FILLED') {
        isVerified = true;
        break;
      }
    }

    const channelData = {
      // Core fields (backwards compatible)
      id: metadata?.external_id || id,
      name: metadata?.title || header?.page_title || null,
      description: metadata?.description || null,
      subscriberCount: subscriberCount,
      thumbnail: thumbnail,
      banner: banner,
      videosCount: videosCount,
      
      // New fields in v2
      handle: handle || metadata?.vanity_channel_url?.replace('http://www.youtube.com/', '').replace('https://www.youtube.com/', '') || null,
      url: metadata?.url || metadata?.vanity_channel_url || `https://www.youtube.com/channel/${id}`,
      isVerified: isVerified || metadata?.is_verified || false,
      keywords: parseKeywords(metadata?.keywords),
      isFamilySafe: metadata?.is_family_safe ?? null,
      availableCountryCodes: metadata?.available_countries || [],
      rssUrl: metadata?.rss_url || null,
    };

    logger.success(`Channel details retrieved successfully`, `Channel: ${id}`);
    return res.status(200).json(channelData);
  } catch (error) {
    logger.error(`Failed to fetch channel details`, `Channel: ${id} | Error: ${error.message}`);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

/**
 * Parse count from various formats like "1.5M" or "1,234,567" or "943 videos"
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

/**
 * Parse keywords from string or array
 */
function parseKeywords(keywords) {
  if (!keywords) return [];
  if (Array.isArray(keywords)) return keywords;
  if (typeof keywords === 'string') {
    return keywords.split(/\s+/).filter(k => k.length > 0);
  }
  return [];
}
