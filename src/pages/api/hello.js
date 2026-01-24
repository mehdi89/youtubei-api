export default function handler(req, res) {
  res.status(200).json({
    message: "Hello from YouTube API",
    version: "2.0.0",
    powered_by: "youtubei.js"
  });
}
