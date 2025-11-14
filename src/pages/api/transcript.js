import Client from '@/utils/ytdlp-client.js';
import { YoutubeTranscript } from '@/utils/ytdlp-client.js';
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

  const { id, type } = req.body;
  const apiKey = req.headers['api-key'];

  if (apiKey !== process.env.YOUTUBE_API_KEY) {
    logger.error("Invalid API key");
    return res.status(401).json({ message: 'Please provide correct API key' });
  }

  if (!id) {
    logger.error("Missing video ID");
    return res.status(400).json({ message: 'Video ID is required' });
  }

  // High-confidence languages for OpenAI extraction
  const highConfidenceLangs = ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'sv', 'da', 'fi', 'no'];

  let selectedLang = null;
  let availableLangCodes = [];
  let availableLanguages = [];

  try {
    // Get available languages first
    availableLanguages = await getTranscriptLanguages(id);
    if (availableLanguages.length > 0) {
      logger.info(`Available languages`, `Count: ${availableLanguages.length}`);
      // Try to extract language codes (support both string and object)
      availableLangCodes = availableLanguages.map(l => {
        if (typeof l === 'string') return l;
        if (l.languageCode) return l.languageCode;
        if (l.lang) return l.lang;
        if (l.code) return l.code;
        logger.warn(`Unexpected language format`, `Language: ${JSON.stringify(l)}`);
        return null;
      }).filter(Boolean); // Remove any null values

      logger.info(`Extracted language codes`, `Codes: ${availableLangCodes.join(', ')}`);
      
      // 1. Prefer English
      if (availableLangCodes.includes('en')) {
        selectedLang = 'en';
      } else {
        // 2. Try high-confidence languages
        const found = highConfidenceLangs.find(code => availableLangCodes.includes(code));
        if (found) {
          selectedLang = found;
        } else if (availableLangCodes.length === 1) {
          // 3. Only one language, use it
          selectedLang = availableLangCodes[0];
        } else if (availableLangCodes.length > 1) {
          // 4. Fallback: use the first available
          selectedLang = availableLangCodes[0];
        }
      }
      
      logger.info(`Selected language`, `Language: ${selectedLang}`);
    }

    const options = selectedLang ? { lang: selectedLang } : {};
    logger.fetch(`Fetching transcript`, `Video: ${id}${selectedLang ? ` | Language: ${selectedLang}` : ''}`);

    // Fetch transcript
    const transcript = await YoutubeTranscript.fetchTranscript(id, options);
    logger.info(`Raw transcript data`, `Length: ${transcript.length} entries`);
    
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
