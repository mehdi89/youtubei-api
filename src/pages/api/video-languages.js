import { Client } from 'youtubei';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const youtube = new Client();
    const id = req.query.id;
    const apiKey = req.headers['api-key'];
    if (apiKey != 'S#D$FG%^$#DEF%G^*$%R^T&Y*U') {
      res.status(401).json({ message: 'Please provide correct api key' });
    }

    try {
      // Fetch video details
      const video = await youtube.getVideo(id);

      // Check if captions are available
      const availableCaptions = video.captions.languages || [];
      if (availableCaptions.length == 0) {
        res.status(200).json({
          message: 'No language available',
          data: [],
        });
        return;
      }

      // Extract language list
      const languages = availableCaptions.map((caption) => {
        return {
          name: caption.name,
          code: caption.code,
          isTranslatable: caption.isTranslatable,
          url: caption.url,
        };
      });

      res.status(200).json({
        message: 'Language fetched successfully',
        data: languages,
      });
    } catch (error) {
      console.error('Error fetching video data:', error);
      res.status(500).json({
        message: error.message,
        data: [],
      });
    }
  } else {
    res.status(405).end();
  }
}
