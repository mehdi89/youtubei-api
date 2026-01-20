import { Innertube, Log } from 'youtubei.js';
import { YoutubeTranscript } from '@/utils/youtube-transcript/dist/youtube-transcript.common.js';
import logger from "@/utils/logger";

// Suppress youtubei.js parser warnings (they're non-fatal)
Log.setLevel(Log.Level.NONE);

// Singleton Innertube instance
let innertubeInstance = null;

async function getInnertube() {
  if (!innertubeInstance) {
    logger.info('Creating new Innertube instance for transcript');
    innertubeInstance = await Innertube.create({
      generate_session_locally: true,
    });
  }
  return innertubeInstance;
}

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
    logger.fetch(`Getting available languages`, `Video: ${videoId}`);
    
    // Try using YoutubeTranscript's listTranscripts first
    try {
      const transcriptList = await YoutubeTranscript.listTranscripts(videoId);
      if (transcriptList && transcriptList.length > 0) {
        const langCodes = transcriptList.map(t => t.languageCode || t.lang).filter(Boolean);
        logger.success(`Found ${langCodes.length} languages via YoutubeTranscript`, `Video: ${videoId}`);
        return langCodes;
      }
    } catch (e) {
      // listTranscripts might not be available, try youtubei.js
    }

    // Fallback to youtubei.js
    const yt = await getInnertube();
    const info = await yt.getInfo(videoId);
    
    if (!info || !info.captions) {
      logger.info(`No captions available`, `Video: ${videoId}`);
      return [];
    }

    // Try to get caption tracks from youtubei.js
    const captionTracks = info.captions?.caption_tracks || [];
    if (captionTracks.length > 0) {
      const langCodes = captionTracks.map(track => track.language_code).filter(Boolean);
      logger.success(`Found ${langCodes.length} languages via youtubei.js`, `Video: ${videoId}`);
      return langCodes;
    }

    return [];
  } catch (error) {
    logger.warn(`Could not get languages, will try default`, `Video: ${videoId} | Error: ${error.message}`);
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

  try {
    // Get available languages first (this is optional, transcript will still work without it)
    availableLangCodes = await getTranscriptLanguages(id);
    
    if (availableLangCodes.length > 0) {
      logger.info(`Available languages`, `Codes: ${availableLangCodes.join(', ')}`);
      
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
