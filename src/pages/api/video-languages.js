import { YoutubeTranscript } from '@/utils/youtube-transcript/dist/youtube-transcript.common.js';
import logger from "@/utils/logger";

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
    logger.error("Missing video ID");
    return res.status(400).json({ message: 'Video ID is required' });
  }

  logger.fetch(`Fetching available languages`, `Video: ${id}`);

  try {
    const languages = await YoutubeTranscript.listLanguages(id);

    if (!languages || languages.length === 0) {
      logger.warn("No languages available", `Video: ${id}`);
      return res.status(404).json({ message: "No languages available for this video" });
    }

    logger.success(`Found ${languages.length} languages`, `Video: ${id}`);
    return res.status(200).json(languages);
  } catch (error) {
    logger.error(`Failed to fetch languages`, `Video: ${id} | Error: ${error.message}`);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
