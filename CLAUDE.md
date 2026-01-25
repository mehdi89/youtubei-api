# YouTubei API

YouTube data extraction API powered by youtubei.js (Next.js).

## Tech Stack

- **Runtime:** Node.js 20
- **Framework:** Next.js 15
- **YouTube Library:** youtubei.js
- **Container:** Docker with multi-stage build

## API Endpoints

All endpoints require `api-key` header matching `YOUTUBE_API_KEY` env var.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/hello` | GET | Health check |
| `/api/video-details` | POST | Get video metadata + transcript |
| `/api/transcript` | POST | Get video transcript |
| `/api/search` | POST | Search videos/channels/playlists |
| `/api/channel-details` | POST | Get channel info |
| `/api/channel-videos` | POST | Get channel videos/shorts |
| `/api/channel-live-videos` | POST | Get channel live streams |
| `/api/playlist` | POST | Get playlist videos |

## Local Development

```bash
npm install
npm run dev
```

## Docker Build

```bash
docker-compose build --no-cache
docker-compose up -d
```

## Deployment

### Servers

| Server | IP | Path |
|--------|-----|------|
| Server 1 | 121.200.63.141 | /var/www/html/youtubei-api |
| Server 2 | 103.204.80.53 | /var/www/html/youtubei-api |
| Server 3 | 121.200.63.197 | /var/www/html/youtubei-api |

### SSH Access

```bash
ssh oisl@121.200.63.141
ssh oisl@103.204.80.53
ssh oisl@121.200.63.197
```

### Deploy Commands

```bash
cd /var/www/html/youtubei-api
git pull origin master
docker-compose down
docker-compose build --no-cache
docker-compose up -d
docker-compose logs -f
```

### Verify Deployment

```bash
curl http://localhost:3000/api/hello
```

Expected response:
```json
{"message":"Hello from YouTube API","version":"2.0.0","powered_by":"youtubei.js"}
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `YOUTUBE_API_KEY` | API key for authentication |
| `EVOMI_API_KEY` | Evomi residential proxy API key (optional, for bypassing YouTube rate limiting) |
| `NODE_ENV` | Set to `production` in Docker |

## Proxy Configuration

The API uses Evomi residential proxies to bypass YouTube rate limiting for transcript fetching.

- **Provider:** Evomi (https://evomi.com)
- **Product:** Residential Proxies Core (`rpc`) at $0.49/GB
- **Usage:** Automatically routes transcript requests through US residential IPs
- **Fallback:** If proxy is unavailable, falls back to direct connection

To enable proxy:
1. Get API key from https://dashboard.evomi.com
2. Add `EVOMI_API_KEY=your_key` to `.env`
3. Restart the container

## Project Structure

```
src/
├── pages/api/          # API endpoints
│   ├── hello.js
│   ├── video-details.js
│   ├── transcript.js
│   ├── search.js
│   ├── channel-details.js
│   ├── channel-videos.js
│   ├── channel-live-videos.js
│   └── playlist.js
└── utils/
    ├── innertube.js    # youtubei.js singleton
    ├── logger.js       # Logging utility
    ├── cache.js        # In-memory caching with TTL
    ├── proxy.js        # Evomi proxy configuration (undici ProxyAgent)
    └── youtube-transcript/  # YouTube transcript library
```
