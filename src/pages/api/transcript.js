import { YoutubeTranscript } from '@/utils/youtube-transcript/dist/youtube-transcript.common.js';
import logger from "@/utils/logger";
import {
  getInnertube,
  decodeEntities,
  selectBestLanguage,
  HIGH_CONFIDENCE_LANGUAGES
} from '@/utils/innertube';

/**
 * Fetch transcript using youtubei.js directly (works with auto-generated captions)
 */
async function fetchTranscriptWithInnerTube(videoId, langCode = null) {
  try {
    const yt = await getInnertube();
    const info = await yt.getInfo(videoId);

    if (!info || !info.captions) {
      return { success: false, error: 'No captions available' };
    }

    const transcriptInfo = await info.getTranscript();
    if (!transcriptInfo || !transcriptInfo.transcript || !transcriptInfo.transcript.content) {
      return { success: false, error: 'No transcript content' };
    }

    const body = transcriptInfo.transcript.content.body;
    if (!body || !body.initial_segments) {
      return { success: false, error: 'No transcript segments' };
    }

    const segments = body.initial_segments;
    const entries = segments.map(segment => ({
      text: segment.snippet?.text || '',
      offset: (segment.start_ms || 0) / 1000,
      duration: ((segment.end_ms || 0) - (segment.start_ms || 0)) / 1000
    })).filter(entry => entry.text);

    if (entries.length === 0) {
      return { success: false, error: 'No transcript text found' };
    }

    return { success: true, entries };
  } catch (error) {
    return { success: false, error: error.message };
  }
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

  let selectedLang = null;
  let availableLangCodes = [];

  try {
    // Get available languages first (this is optional, transcript will still work without it)
    availableLangCodes = await getTranscriptLanguages(id);
    
    if (availableLangCodes.length > 0) {
      logger.info(`Available languages`, `Codes: ${availableLangCodes.join(', ')}`);
      
      // Use shared language selection utility
      selectedLang = selectBestLanguage(availableLangCodes);
      
      if (selectedLang) {
        logger.info(`Selected language`, `Language: ${selectedLang}`);
      }
    }

    const options = selectedLang ? { lang: selectedLang } : {};
    logger.fetch(`Fetching transcript`, `Video: ${id}${selectedLang ? ` | Language: ${selectedLang}` : ''}`);

    let transcript = null;
    let fetchMethod = '';

    // Try YoutubeTranscript first
    try {
      transcript = await YoutubeTranscript.fetchTranscript(id, options);
      fetchMethod = 'YoutubeTranscript';
    } catch (ytError) {
      logger.warn(`YoutubeTranscript failed, trying youtubei.js`, `Video: ${id}`);

      // Fallback to youtubei.js
      const innertubeResult = await fetchTranscriptWithInnerTube(id, selectedLang);
      if (innertubeResult.success) {
        transcript = innertubeResult.entries;
        fetchMethod = 'youtubei.js';
      } else {
        // Both methods failed
        throw new Error(ytError.message || 'No transcripts available');
      }
    }

    logger.info(`Raw transcript data`, `Length: ${transcript.length} entries | Method: ${fetchMethod}`);

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

    logger.success(`Transcript fetched successfully`, `Video: ${id} | Length: ${data.length} chars | Method: ${fetchMethod}`);
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
