import youtubei from "@/utils/youtubei";
import logger from "@/utils/logger";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    logger.error("Method not allowed", `Method: ${req.method}`);
    return res.status(405).end();
  }

  const youtube = youtubei;
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
    const channel = await youtube.findOne(id, { type: "channel" });

    // Check for error response from yt-dlp wrapper
    if (!channel || channel.error) {
      logger.error("Channel not found", `ID: ${id}`);
      return res.status(404).json({ message: "Channel not found" });
    }

    const channelData = {
      id: channel?.id,
      name: channel?.name,
      description: channel?.description,
      isVerified: channel?.isVerified,
      subscriberCount: channel?.subscriberCount,
      thumbnail: channel?.thumbnails?.[0]?.url || null,
      banner: channel?.banner?.[0]?.url || null,
    };

    logger.success(`Channel details retrieved successfully`, `Channel: ${id}`);
    return res.status(200).json(channelData);
  } catch (error) {
    logger.error(`Failed to fetch channel details`, `Channel: ${id} | Error: ${error.message}`);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
