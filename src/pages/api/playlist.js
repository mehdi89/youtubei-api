import { Client } from "youtubei";
export default async function handler(req, res) {
  if (req.method === "POST") {
    const youtube = new Client();
    const { id, page } = req.body;
    const apiKey = req.headers['api-key'];
    if (apiKey!='S#D$FG%^$#DEF%G^*$%R^T&Y*U') {
        res.status(401).json({message:'Please provide correct api key'});
    }
    var items = {};
    var newVideos = {};
    var playlist = await youtube.getPlaylist(id);
    if (page > 1) {
      for (var i = 2; i <= page; i++) {
        try {
          newVideos = await playlist.videos.next(i);
          console.log(newVideos);
        } catch (error) {
          res.status(200).json(newVideos);
        }
      }
    }

    if (page > 1) {
        if (newVideos.length > 0) {
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
        }else{
            items=[];
        }
    //   if (page == 2) {
    //     newVideos = newVideos?.slice(30, 60);
    //   }
      
      res.status(200).json(items);
    } else {

      items = playlist?.videos?.items?.map(function (item) {
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
  }else{
    res.status(405).end();
  }
}
