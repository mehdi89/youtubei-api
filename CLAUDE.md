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

### Deploy Commands

```bash
cd /var/www/html/youtubei-api
git pull origin master
docker-compose down
docker-compose build --no-cache
docker-compose up -d
docker-compose logs -f
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `YOUTUBE_API_KEY` | API key for authentication |
| `EVOMI_API_KEY` | Evomi proxy API key (optional) |
| `NODE_ENV` | Set to `production` in Docker |
