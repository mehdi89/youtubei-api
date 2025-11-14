# YouTube API Server

A high-performance YouTube data extraction API built with **FastAPI** and **yt-dlp**. This API provides comprehensive access to YouTube video details, transcripts, search, channel information, and playlists.

## Features

- 🚀 **Fast**: Built with FastAPI for high performance
- 🎯 **Complete**: All major YouTube data extraction endpoints
- 📝 **Transcripts**: Full support for video transcripts with timestamps
- 🔍 **Search**: Search videos, channels, and playlists
- 📺 **Channels**: Get channel details, videos, and live streams
- 📋 **Playlists**: Extract all videos from any playlist
- 🍪 **Bot Protection**: Cookie-based authentication bypass
- 🐳 **Docker Ready**: Fully containerized deployment
- 🔐 **Secure**: API key authentication

## Tech Stack

- **FastAPI**: Modern Python web framework
- **yt-dlp**: Powerful YouTube downloader library
- **Python 3.11**: Latest stable Python
- **Docker**: Containerized deployment
- **uvicorn**: High-performance ASGI server

## Quick Start

### Prerequisites

- Docker and Docker Compose
- YouTube API Key (set in `.env`)
- YouTube cookies file (optional, for bot detection bypass)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd youtubei-api
```

2. Create `.env` file:
```bash
cp .env.example .env
# Edit .env and add your YOUTUBE_API_KEY
```

3. (Optional) Add YouTube cookies:
```bash
# Place your youtube_cookies.txt in the root directory
# See https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp
```

4. Build and run with Docker:
```bash
docker-compose build
docker-compose up -d
```

5. Check health:
```bash
curl http://localhost:3000/api/hello
```

## API Endpoints

### Health Check
```bash
GET /api/hello
```

### Video Details
```bash
POST /api/video-details
Content-Type: application/json
api-key: YOUR_API_KEY

{
  "id": "VIDEO_ID",
  "transcript": true,
  "timestamped": true
}
```

### Transcript
```bash
POST /api/transcript
Content-Type: application/json
api-key: YOUR_API_KEY

{
  "id": "VIDEO_ID",
  "type": "plain"
}
```

### Search
```bash
POST /api/search
Content-Type: application/json
api-key: YOUR_API_KEY

{
  "query": "python tutorial",
  "type": "video",
  "page": 1
}
```

### Channel Details
```bash
POST /api/channel-details
Content-Type: application/json
api-key: YOUR_API_KEY

{
  "id": "CHANNEL_ID"
}
```

### Channel Videos
```bash
POST /api/channel-videos
Content-Type: application/json
api-key: YOUR_API_KEY

{
  "id": "CHANNEL_ID",
  "page": 1
}
```

### Playlist Videos
```bash
POST /api/playlist
Content-Type: application/json
api-key: YOUR_API_KEY

{
  "id": "PLAYLIST_ID",
  "page": 1
}
```

For complete API documentation with request/response examples, see [API_DOCUMENTATION.md](./docs/API_DOCUMENTATION.md).

## Docker Deployment

### Production Deployment

```bash
# Build the image
docker-compose build

# Start the service
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the service
docker-compose down
```

### Environment Variables

- `YOUTUBE_API_KEY`: Your API key for authentication
- `PORT`: Server port (default: 3000)

### Docker Compose Configuration

The `docker-compose.yml` includes:
- Health checks
- Resource limits (1 CPU, 1GB RAM)
- Log rotation
- Auto-restart policy

## Local Development

### Without Docker

1. Install Python 3.11+
2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Run the server:
```bash
python main.py
```

4. Access at http://localhost:3000

### With Auto-reload

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 3000
```

## YouTube Cookies Setup

To bypass YouTube's bot detection, you need to provide cookies from an authenticated YouTube session:

1. Install a browser extension to export cookies (e.g., "Get cookies.txt LOCALLY")
2. Visit youtube.com and log in
3. Export cookies in Netscape format
4. Save as `youtube_cookies.txt` in the project root
5. Rebuild the Docker image

The API will automatically detect and use the cookies file.

## Project Structure

```
.
├── main.py                 # FastAPI application
├── requirements.txt        # Python dependencies
├── Dockerfile             # Docker build configuration
├── docker-compose.yml     # Docker Compose setup
├── youtube_cookies.txt    # YouTube cookies (optional)
├── .env                   # Environment variables
├── API_DOCUMENTATION.md   # Complete API reference
├── FEATURE_EXPANSION.md   # Feature roadmap
└── README.md             # This file
```

## Error Handling

The API provides consistent error responses:

- **401**: Invalid API key
- **403**: YouTube bot detection (cookies may be expired)
- **404**: Resource not found
- **500**: Internal server error

## Performance

- Supports concurrent requests
- Response caching via yt-dlp
- Resource limits configurable in docker-compose.yml
- Typical response times: 1-3 seconds per request

## Monitoring

View real-time logs:
```bash
docker-compose logs -f
```

Check container status:
```bash
docker-compose ps
```

Health check endpoint:
```bash
curl http://localhost:3000/api/hello
```

## Troubleshooting

### Bot Detection Errors

If you see "Sign in to confirm you're not a bot":
1. Update your `youtube_cookies.txt` file
2. Rebuild: `docker-compose build`
3. Restart: `docker-compose up -d`

### High Memory Usage

Adjust limits in `docker-compose.yml`:
```yaml
deploy:
  resources:
    limits:
      memory: 2G  # Increase if needed
```

### Slow Response Times

- Check Docker resource allocation
- Consider enabling response caching
- Monitor concurrent request load

## Migration from Node.js

This is a complete rewrite from the previous Node.js implementation. The API maintains **100% backward compatibility** with all request and response formats.

For the old Node.js documentation, see [docs/README-OLD-NODEJS.md](./docs/README-OLD-NODEJS.md).

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

[Your License Here]

## Support

For issues and questions:
- Open an issue on GitHub
- Check [API_DOCUMENTATION.md](./docs/API_DOCUMENTATION.md) for usage details
- Review [FEATURE_EXPANSION.md](./docs/FEATURE_EXPANSION.md) for planned features
