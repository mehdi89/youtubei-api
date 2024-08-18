import { Client } from "youtubei";
import { YoutubeTranscript } from "youtube-transcript";

export default async function handler(req, res) {
  if (req.method === "POST") {
    const youtube = new Client();
    const { id, type } = req.body;
    const apiKey = req.headers["api-key"];
    if (apiKey != "S#D$FG%^$#DEF%G^*$%R^T&Y*U") {
      res.status(401).json({ message: "Please provide correct api key" });
    }

    try {
      const transcript = await YoutubeTranscript.fetchTranscript(id);
      var data = "";
      if (type == "timestamped") {
        transcript.forEach((entry) => {
          var timedString =
            "time : " + entry.offset + " second. Text: " + entry.text;
          data += timedString;
        });
      } else {
        transcript.forEach((entry) => {
          data += entry.text;
        });
      }
      data = data.replace(/&amp;#?[a-z0-9]+;/g, '');
      res.status(200).json({
        data: data,
      });
    } catch (error) {
      console.error("Error fetching video data:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  } else {
    res.status(405).end();
  }
}
