import { Client } from 'youtubei';
import { YoutubeTranscript } from 'youtube-transcript';
import logger from "@/utils/logger";

function decodeEntities(encodedString) {
  var translate_re = /&(nbsp|amp|quot|lt|gt);/g;
  var translate = {
    nbsp: ' ',
    amp: '&',
    quot: '"',
    lt: '<',
    gt: '>',
  };
  return encodedString
    .replace(translate_re, function (match, entity) {
      return translate[entity];
    })
    .replace(/&#(\d+);/gi, function (match, numStr) {
      var num = parseInt(numStr, 10);
      return String.fromCharCode(num);
    });
}

async function getTranscriptLanguages(videoId) {
  try {
    const youtube = new Client();
    logger.fetch(`Getting available languages`, `Video: ${videoId}`);

    const video = await youtube.getVideo(videoId);
    if (!video || !video.captions) {
      logger.info(`No captions available`, `Video: ${videoId}`);
      return [];
    }

    const availableCaptions = video.captions.languages || [];
    logger.success(`Found ${availableCaptions.length} languages`, `Video: ${videoId}`);
    return availableCaptions;
  } catch (error) {
    logger.error(`Failed to get languages`, `Video: ${videoId} | Error: ${error.message}`);
    return [];
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    logger.error("Method not allowed", `Method: ${req.method}`);
    return res.status(405).end();
  }

  const { id, type, lang } = req.body;
  const apiKey = req.headers['api-key'];

  if (apiKey !== process.env.YOUTUBE_API_KEY) {
    logger.error("Invalid API key");
    return res.status(401).json({ message: 'Please provide correct API key' });
  }

  if (!id) {
    logger.error("Missing video ID");
    return res.status(400).json({ message: 'Video ID is required' });
  }

  const options = lang ? { lang: lang } : {};
  logger.fetch(`Fetching transcript`, `Video: ${id}${lang ? ` | Language: ${lang}` : ''}`);

  try {
    // Get available languages first
    const languages = await getTranscriptLanguages(id);
    if (languages.length > 0) {
      logger.info(`Available languages`, `Count: ${languages.length}`);
    }

    // Fetch transcript
    const transcript = await YoutubeTranscript.fetchTranscript(id, options);
    
    let data = '';
    if (type === 'timestamped') {
      transcript.forEach((entry) => {
        var timedString = `time : ${entry.offset} second. Text: ${entry.text}`;
        data += timedString;
      });
    } else {
      transcript.forEach((entry) => {
        data += ' ' + entry.text;
      });
    }
    data = decodeEntities(data);

    logger.success(`Transcript fetched successfully`, `Video: ${id} | Length: ${data.length} chars`);
    res.status(200).json({ data });
  } catch (error) {
    if (error.message?.includes('Transcript is disabled')) {
      logger.info(`Transcript disabled`, `Video: ${id}`);
    } else {
      logger.error(`Failed to fetch transcript`, `Video: ${id} | Error: ${error.message}`);
    }
    res.status(500).json({ message: error.message });
  }
}
