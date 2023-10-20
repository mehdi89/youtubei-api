import { Client } from "youtubei";
export default async function handler(req, res) {
  if (req.method === "POST") {
    const youtube = new Client();
    const { id, page } = req.body;
    var items = {};
    var newVideos = {};
    var channel = await youtube.findOne(id, { type: "channel" });

    // console.log(channel.length);
    if (page > 1) {
      for (var i = 2; i <= page; i++) {
        try {
          newVideos = await channel.videos.next(i);
        } catch (error) {
          res.status(200).json(newVideos);
        }
      }
    } else {
      channel = await channel.videos.next();
    }
    // console.log(channel.videos.items);
    if (page > 1 && newVideos.length > 0) {
      if (page == 2) {
        newVideos = newVideos?.slice(30, 60);
      }
      items = newVideos?.map(function (item) {
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
    } else {
      // console.log(channel);
      items = channel?.map(function (item) {
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
    // await response.videos.next();
    // console.log(response.videos.items);

    res.status(200).json("ok");
  } else {
    res.status(405).end();
  }
}
