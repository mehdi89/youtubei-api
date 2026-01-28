# YouTube API Server

A high-performance YouTube data extraction API built with **Next.js** and **youtubei.js**. This API provides comprehensive access to YouTube video details, transcripts, search, channel information, and playlists.

## Features

- **Fast**: Built with Next.js for high performance
- **Complete**: All major YouTube data extraction endpoints
- **Transcripts**: Full support for video transcripts with timestamps
- **Search**: Search videos, channels, and playlists
- **Channels**: Get channel details, videos, and live streams
- **Playlists**: Extract all videos from any playlist
- **Proxy Support**: Residential proxy integration to bypass rate limiting
- **Caching**: In-memory caching with configurable TTL
- **Docker Ready**: Fully containerized deployment
- **Secure**: API key authentication

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

## Technical Implementation

### Transcript Fetching

The transcript fetching uses **youtubei.js** directly for optimal performance:

```
┌─────────────────────────────────────────────────────────────┐
│                    Transcript Flow                          │
├─────────────────────────────────────────────────────────────┤
│  1. Get video info via youtubei.js                          │
│     └─> yt.getInfo(videoId)                                 │
│                                                             │
│  2. Extract caption tracks from info.captions               │
│     └─> Select best language (English preferred)            │
│                                                             │
│  3. Fetch caption XML                                       │
│     ├─> Primary: yt.session.http.fetch(captionUrl)          │
│     └─> Fallback: fetch() with Evomi proxy                  │
│                                                             │
│  4. Parse XML and extract text segments                     │
│     └─> Returns plain text or timestamped entries           │
└─────────────────────────────────────────────────────────────┘
```

**Language Selection Priority:**
1. English (`en` or `en-*`)
2. High-confidence languages: `es`, `fr`, `de`, `it`, `pt`, `nl`, `sv`, `da`, `fi`, `no`
3. First available track

### Proxy Configuration

The API uses Evomi residential proxies as a **fallback** when the primary youtubei.js session fetch fails:

```
┌─────────────────────────────────────────────────────────────┐
│                     Proxy Flow                              │
├─────────────────────────────────────────────────────────────┤
│  1. Try youtubei.js session fetch (no proxy)                │
│     └─> Uses internal authentication                        │
│                                                             │
│  2. If fails, use Evomi proxy                               │
│     ├─> Generate credentials via Evomi API                  │
│     ├─> Create undici ProxyAgent                            │
│     ├─> Set as global fetch dispatcher                      │
│     ├─> Make request through US residential IP              │
│     └─> Restore original dispatcher                         │
│                                                             │
│  3. If proxy unavailable, direct connection                 │
└─────────────────────────────────────────────────────────────┘
```

**Setup:**
1. Get API key from https://dashboard.evomi.com
2. Add `EVOMI_API_KEY=your_key` to `.env`
3. Restart the container

**Details:**
- **Provider**: Evomi Residential Proxies Core
- **Cost**: $0.49/GB
- **Region**: US residential IPs
- **Credential caching**: 1 hour

### Caching

In-memory cache with TTL to avoid redundant YouTube requests:

| Data Type | TTL | Reason |
|-----------|-----|--------|
| Transcripts | 24 hours | Rarely change |
| Video details | 1 hour | Metadata may update |
| Channel details | 1 hour | Subscriber count changes |
| Channel videos | 15 minutes | New uploads |
| Playlists | 15 minutes | Playlist edits |
| Search results | 5 minutes | Dynamic results |
| Live content | 2 minutes | Frequently changing |

**Cache Implementation:**
- Singleton `Map`-based store
- Automatic cleanup every 5 minutes
- Statistics tracking (hits, misses, hit rate)

> **Note**: Cache is in-memory only, lost on restart. For production persistence, consider Redis.

## Project Structure

```
src/
├── pages/api/              # API endpoints
│   ├── hello.js            # Health check
│   ├── video-details.js    # Video metadata + transcript
│   ├── transcript.js       # Standalone transcript endpoint
│   ├── search.js           # Search videos/channels/playlists
│   ├── channel-details.js  # Channel information
│   ├── channel-videos.js   # Channel video listings
│   ├── channel-live-videos.js # Live streams
│   └── playlist.js         # Playlist videos
└── utils/
    ├── innertube.js        # youtubei.js singleton + helpers
    ├── logger.js           # Colored console logging
    ├── cache.js            # In-memory TTL cache
    └── proxy.js            # Evomi proxy (undici ProxyAgent)
```

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

# Run tests
npm test

# Build for production
npm run build

# Start production server
npm start
```

## Error Handling

Consistent error responses:

| Code | Meaning |
|------|---------|
| 401 | Invalid API key |
| 403 | Video unavailable or private |
| 404 | Resource not found |
| 405 | Method not allowed |
| 500 | Internal server error |
| 503 | Network error / YouTube unavailable |

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
