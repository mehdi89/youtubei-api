import { Client } from "youtubei";

export default async function handler(
  req,
  res
) {
  if (req.method === "POST") {
    const youtube = new Client();
    const { type, query,page } = req.body;
    const apiKey = req.headers['api-key'];
    if (apiKey!='S#D$FG%^$#DEF%G^*$%R^T&Y*U') {
        res.status(500).json({message:'Please provide correct api key'});
    }
    var items;
    var nextResponse;

    const response = await youtube.search(query, {
      type: type,
    });
    if (page>1) {
      for(var i=2;i<=page;i++){
        nextResponse = await response.next();
      }
    }
    if (type == "video") {
      if (page>1) {
        items = nextResponse?.map(function (item) {
          return {
            id: item?.id,
            title: item?.title,
            duration: item?.duration,
            description: item?.description,
            isLive: item?.isLive,
            viewCount: item?.viewCount,
            uploadDate: item?.uploadDate,
            thumbnail: `https://img.youtube.com/vi/${item?.id}/mqdefault.jpg`,
            channelName: item?.channel.name,
            channelID: item?.channel.id,
          };
        });
        res.status(200).json(items);
      }else{
        items = response?.items?.map(function (item) {
          return {
            id: item?.id,
            title: item?.title,
            duration: item?.duration,
            description: item?.description,
            isLive: item?.isLive,
            viewCount: item?.viewCount,
            uploadDate: item?.uploadDate,
            thumbnail: `https://img.youtube.com/vi/${item?.id}/mqdefault.jpg`,
            channelName: item?.channel.name,
            channelID: item?.channel.id,
          };
        });
        res.status(200).json(items);
      }
    } else if (type == "channel") {
      items = response?.items?.map(function (item) {
        return {
          id: item.id,
          title: item.name,
          videoCount: item.videoCount,
          subscriberCount: item.subscriberCount,
          thumbnails: item.thumbnails[0]?.url,
        };
      });
      res.status(200).json(items);
    } else if (type == "playlist") {
      items = response?.items?.map(function (item) {
        return {
          id: item.id,
          title: item.title,
          videoCount: item.videoCount,
          channelName: item.channel.name,
          channelID: item.channel.id,
        };
      });
      res.status(200).json(items);
    }
  } else {
    res.status(405).end(); 
  }
}
