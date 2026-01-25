# YouTube API Server

A high-performance YouTube data extraction API built with **Next.js** and **youtubei.js**. This API provides comprehensive access to YouTube video details, transcripts, search, channel information, and playlists.

## Features

- 🚀 **Fast**: Built with Next.js for high performance
- 🎯 **Complete**: All major YouTube data extraction endpoints
- 📝 **Transcripts**: Full support for video transcripts with timestamps
- 🔍 **Search**: Search videos, channels, and playlists
- 📺 **Channels**: Get channel details, videos, and live streams
- 📋 **Playlists**: Extract all videos from any playlist
- 🌐 **Proxy Support**: Residential proxy integration to bypass rate limiting
- 💾 **Caching**: In-memory caching with configurable TTL
- 🐳 **Docker Ready**: Fully containerized deployment
- 🔐 **Secure**: API key authentication

## Tech Stack

- **Framework**: Next.js 15
- **Runtime**: Node.js 20
- **YouTube Library**: youtubei.js
- **Proxy**: Evomi residential proxies (via undici ProxyAgent)
- **Container**: Docker with multi-stage build

## Quick Start

### Prerequisites

- Docker and Docker Compose
- YouTube API Key (set in `.env`)
- Evomi API Key (optional, for proxy support)

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
# Optionally add EVOMI_API_KEY for proxy support
```

3. Build and run with Docker:
```bash
docker-compose build
docker-compose up -d
```

4. Check health:
```bash
curl http://localhost:3000/api/hello
```

Expected response:
```json
{"message":"Hello from YouTube API","version":"2.0.0","powered_by":"youtubei.js"}
```

## API Endpoints

All endpoints require `api-key` header matching `YOUTUBE_API_KEY` env var.

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

### Channel Live Videos
```bash
POST /api/channel-live-videos
Content-Type: application/json
api-key: YOUR_API_KEY

{
  "id": "CHANNEL_ID"
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

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `YOUTUBE_API_KEY` | Yes | API key for authentication |
| `EVOMI_API_KEY` | No | Evomi residential proxy API key for bypassing rate limiting |
| `NODE_ENV` | No | Set to `production` in Docker |

## Proxy Configuration

The API supports Evomi residential proxies to bypass YouTube rate limiting for transcript fetching.

### Setup

1. Get API key from https://dashboard.evomi.com
2. Add to `.env`:
```bash
EVOMI_API_KEY=your_api_key_here
```
3. Restart the container

### How it works

- **Provider**: Evomi Residential Proxies Core
- **Cost**: $0.49/GB
- **Automatic**: Transcript requests automatically route through US residential IPs
- **Fallback**: If proxy fails, falls back to direct connection
- **Caching**: Proxy credentials cached for 1 hour

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

### Docker Compose Features

- Health checks (every 30s)
- Resource limits (1 CPU, 1GB RAM)
- Log rotation (10MB, 3 files)
- Auto-restart policy

## Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Project Structure

```
src/
├── pages/api/              # API endpoints
│   ├── hello.js
│   ├── video-details.js
│   ├── transcript.js
│   ├── search.js
│   ├── channel-details.js
│   ├── channel-videos.js
│   ├── channel-live-videos.js
│   └── playlist.js
└── utils/
    ├── innertube.js        # youtubei.js singleton
    ├── logger.js           # Logging utility
    ├── cache.js            # In-memory caching with TTL
    ├── proxy.js            # Evomi proxy configuration
    └── youtube-transcript/ # YouTube transcript library
```

## Caching

The API implements in-memory caching with configurable TTL:

| Data Type | TTL |
|-----------|-----|
| Video details | 1 hour |
| Transcripts | 24 hours |
| Channel info | 1 hour |
| Search results | 30 minutes |

## Error Handling

Consistent error responses:

- **401**: Invalid API key
- **403**: Video unavailable or private
- **404**: Resource not found
- **405**: Method not allowed
- **500**: Internal server error
- **503**: Network error / YouTube unavailable

## Monitoring

View real-time logs:
```bash
docker-compose logs -f
```

Check container status:
```bash
docker-compose ps
```

Health check:
```bash
curl http://localhost:3000/api/hello
```

## Troubleshooting

### Rate Limiting (429 errors)

If you see transcript failures due to rate limiting:
1. Enable Evomi proxy by adding `EVOMI_API_KEY` to `.env`
2. Rebuild and restart: `docker-compose up --build -d`

### No Transcripts Available

Some videos don't have transcripts:
- Shorts (usually no captions)
- Live streams (captions disabled)
- Videos where creator disabled captions

### High Memory Usage

Adjust limits in `docker-compose.yml`:
```yaml
deploy:
  resources:
    limits:
      memory: 2G  # Increase if needed
```

## License

MIT
