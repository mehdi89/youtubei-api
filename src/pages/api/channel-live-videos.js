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

  logger.fetch(`Fetching live videos`, `Channel: ${id}`);

  try {
    const channel = await youtube.findOne(id, { type: "channel" });

    if (!channel) {
      logger.error("Channel not found", `ID: ${id}`);
      return res.status(404).json({ message: "Channel not found" });
    }

    const liveVideos = await channel.getLiveStreams();
    const items = liveVideos.map(item => ({
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

    logger.success(`Found ${items.length} live videos`, `Channel: ${id}`);
    return res.status(200).json(items);
  } catch (error) {
    logger.error(`Failed to fetch live videos`, `Channel: ${id} | Error: ${error.message}`);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
