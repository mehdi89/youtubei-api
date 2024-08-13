import youtubei from "@/utils/youtubei";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end(); // Method Not Allowed
  }

  const youtube = youtubei;
  const { type, query, page = 1 } = req.body;
  const apiKey = req.headers['api-key'];

  if (apiKey !== 'S#D$FG%^$#DEF%G^*$%R^T&Y*U') {
    return res.status(401).json({ message: 'Please provide correct API key' }); // Unauthorized
  }

  console.log(`Searching for ${type} with query: ${query}`);

  try {
    let items = [];
    let response = await youtube.search(query, { type });
    let nextResponse;

    if (!response || !response.items || response.items.length === 0) {
      return res.status(404).json({ message: 'No results found' }); // Not Found
    }

    if (page > 1) {
      for (let i = 2; i <= page; i++) {
        nextResponse = await response.next();
        if (!nextResponse || !nextResponse.items || nextResponse.items.length === 0) {
          break;
        }
        response.items = nextResponse.items; // Update with the latest items
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
          thumbnail: `https://img.youtube.com/vi/${item?.id}/mqdefault.jpg`,
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
        return res.status(400).json({ message: 'Invalid search type' }); // Bad Request
    }

    res.status(200).json(items);
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({ message: "Internal Server Error" }); // Internal Server Error
  }
}
