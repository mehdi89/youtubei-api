import { Client } from 'youtubei';
import { YoutubeTranscript } from 'youtube-transcript';

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
  const youtube = new Client();

  // Fetch video details
  const video = await youtube.getVideo(videoId);

  // Check if captions are available
  const availableCaptions = video.captions.languages || [];

  // Extract language list
  const languages = availableCaptions.map((caption) => caption);

  return languages;
}

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const youtube = new Client();
    const { id, type, lang } = req.body;
    const apiKey = req.headers['api-key'];
    if (apiKey != 'S#D$FG%^$#DEF%G^*$%R^T&Y*U') {
      res.status(401).json({ message: 'Please provide correct api key' });
    }

    const options = lang ? { lang: lang } : {};

    try {
      getTranscriptLanguages(id)
        .then((languages) =>
          console.log('Available transcript languages:', languages)
        )
        .catch((error) => console.error('Error:', error));

      const transcript = await YoutubeTranscript.fetchTranscript(id, options);

      var data = '';
      if (type == 'timestamped') {
        transcript.forEach((entry) => {
          var timedString =
            'time : ' + entry.offset + ' second. Text: ' + entry.text;
          data += timedString;
        });
      } else {
        transcript.forEach((entry) => {
          data += ' ' + entry.text;
        });
      }
      data = decodeEntities(data);

      res.status(200).json({
        data: data,
      });
    } catch (error) {
      console.error('Error fetching video data:', error);
      res.status(500).json({ message: error.message });
    }
  } else {
    res.status(405).end();
  }
}
