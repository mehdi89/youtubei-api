import { Client } from "youtubei";
export default async function handler(req, res) {
  if (req.method === "POST") {
    const youtube = new Client();
    const { id } = req.body;
    const apiKey = req.headers['api-key'];
    if (apiKey!='S#D$FG%^$#DEF%G^*$%R^T&Y*U') {
        res.status(401).json({message:'Please provide correct api key'});
    }
    var channel = await youtube.findOne("UCa93wT6jsey99pPSmjHANEg", { type: "channel" });
    let response={
      'id':channel?.id,
      'user_name':channel?.subscriberCount,
      'name':channel?.name,
      'thumbnails':channel?.thumbnails,
    }

    res.status(200).json(response);
  }else{
    res.status(405).end();
  }
}
