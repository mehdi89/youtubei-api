import youtubei from "@/utils/youtubei";
import logger from "@/utils/logger";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    logger.error("Method not allowed", `Method: ${req.method}`);
    return res.status(405).end();
  }

  const youtube = youtubei;
  const { type, query, page = 1 } = req.body;
  const apiKey = req.headers['api-key'];

  if (apiKey !== process.env.YOUTUBE_API_KEY) {
    logger.error("Invalid API key");
    return res.status(401).json({ message: 'Please provide correct API key' });
  }

  logger.fetch(`Searching ${type}`, `Query: "${query}" | Page: ${page}`);

  try {
    let items = [];
    let response = await youtube.search(query, { type });
    let nextResponse;

    if (!response || !response.items || response.items.length === 0) {
      logger.info("No results found", `Type: ${type} | Query: "${query}"`);
      return res.status(404).json({ message: 'No results found' });
    }

    if (page > 1) {
      for (let i = 2; i <= page; i++) {
        logger.fetch(`Loading page ${i}`, `Type: ${type} | Query: "${query}"`);
        nextResponse = await response.next();
        if (!nextResponse || !nextResponse.items || nextResponse.items.length === 0) {
          break;
        }
        response.items = nextResponse.items;
      }
    }

    switch (type) {
      case "video":
        items = response.items.map(item => ({
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
          channelThumbnail: item?.channel?.thumbnails?.[0]?.url,
        }));
        break;

      case "channel":
        items = response.items.map(item => {
          let lastThumbnail = Object.keys(item.thumbnails).pop();
          return {
            id: item?.id,
            title: item?.name,
            videoCount: item?.videoCount,
            subscriberCount: item?.subscriberCount,
            thumbnails: item?.thumbnails?.[lastThumbnail]?.url,
          };
        });
        break;

      case "playlist":
        items = response.items.map(item => ({
          id: item?.id,
          title: item?.title,
          videoCount: item?.videoCount,
          channelName: item?.channel?.name,
          channelID: item?.channel?.id,
        }));
        break;

      default:
        logger.error("Invalid search type", `Type: ${type}`);
        return res.status(400).json({ message: 'Invalid search type' });
    }

    logger.success(`Found ${items.length} ${type}s`, `Query: "${query}" | Page: ${page}`);
    res.status(200).json(items);
  } catch (error) {
    logger.error("Search failed", `Error: ${error.message}`);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
