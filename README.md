# YouTubei API

A powerful and efficient YouTube data API built with Next.js that provides access to video details, transcripts, channel information, and search functionality.

## Features

- 🎥 Video Details & Transcripts
- 📺 Channel Information
- 🔍 Search (Videos, Channels, Playlists)
- 📝 Multi-language Transcript Support
- 🔴 Live Stream Detection
- 📋 Playlist Information
- 🌐 Cross-Origin Support
- 📊 Detailed Response Format

## Getting Started

### Prerequisites

- Node.js 16.x or higher
- Docker (optional, for containerized deployment)

### Environment Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/youtubei-api.git
cd youtubei-api
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```env
YOUTUBE_API_KEY=your_api_key_here
```

### Development

Run the development server:
```bash
npm run dev
```

### Production Deployment

Using Docker:
```bash
docker compose up -d prod
```

## API Endpoints

All endpoints require a valid API key passed in the headers as `api-key`.

### Video Details

`POST /api/video-details`
```json
{
  "id": "video_id",
  "transcript": true
}
```

### Search

`POST /api/search`
```json
{
  "type": "video|channel|playlist",
  "query": "search term",
  "page": 1
}
```

### Channel Videos

`POST /api/channel-videos`
```json
{
  "id": "channel_id",
  "page": 1
}
```

### Channel Live Videos

`POST /api/channel-live-videos`
```json
{
  "id": "channel_id"
}
```

### Channel Details

`POST /api/channel-details`
```json
{
  "id": "channel_id"
}
```

### Playlist Videos

`POST /api/playlist`
```json
{
  "id": "playlist_id",
  "page": 1
}
```

### Video Transcripts

`POST /api/transcript`
```json
{
  "id": "video_id",
  "type": "timestamped",
  "lang": "en"
}
```

### Video Languages

`POST /api/video-languages`
```json
{
  "id": "video_id"
}
```

## Response Formats

### Video Response
```json
{
  "id": "video_id",
  "title": "Video Title",
  "duration": "10:00",
  "description": "Video description",
  "isLive": false,
  "viewCount": 1000,
  "uploadDate": "2024-01-01",
  "thumbnail": "thumbnail_url",
  "channelName": "Channel Name",
  "channelID": "channel_id",
  "transcript": {
    "available": true,
    "content": "transcript text",
    "reason": null
  }
}
```

### Channel Response
```json
{
  "id": "channel_id",
  "name": "Channel Name",
  "description": "Channel description",
  "isVerified": true,
  "subscriberCount": 1000000,
  "thumbnail": "thumbnail_url",
  "banner": "banner_url",
  "joinedDate": "2020-01-01",
  "location": "US",
  "videosCount": 100,
  "viewCount": 1000000
}
```

## Error Handling

The API uses standard HTTP status codes:

- 200: Success
- 400: Bad Request
- 401: Unauthorized (Invalid API key)
- 404: Not Found
- 405: Method Not Allowed
- 500: Internal Server Error

Error responses include a message:
```json
{
  "message": "Error description"
}
```

## Logging System

The API includes a comprehensive logging system with visual indicators:

- ✅ Success operations
- ❌ Error messages
- ⚠️ Warning notifications
- ℹ️ Information logs
- 🔄 Fetch operations

Logs include timestamps and contextual information for easy debugging.

## Docker Support

The project includes Docker configuration for development, testing, and production environments. Use the provided `docker-compose.yml` and `docker-deploy.sh` for deployment.

### Docker Commands

Build and run production:
```bash
docker compose build prod
docker compose up -d prod
```

Check container health:
```bash
docker compose ps
docker compose logs prod
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
