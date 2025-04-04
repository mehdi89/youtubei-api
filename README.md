# YouTube API Service

A Next.js based API service that provides endpoints for fetching YouTube data including video details, channel information, playlists, and transcripts.

## Features

- Search videos, channels, and playlists
- Get video details with transcripts
- Fetch channel information and videos
- Get playlist contents
- Live video support
- Video transcript and language support

## API Endpoints

All endpoints require an API key in the header: `api-key: S#D$FG%^$#DEF%G^*$%R^T&Y*U`

### Search
```http
POST /api/search
Content-Type: application/json
api-key: S#D$FG%^$#DEF%G^*$%R^T&Y*U

{
    "type": "video|channel|playlist",
    "query": "search term",
    "page": 1
}
```

### Video Details
```http
POST /api/video-details
Content-Type: application/json
api-key: S#D$FG%^$#DEF%G^*$%R^T&Y*U

{
    "id": "video_id",
    "transcript": true
}
```

### Channel Videos
```http
POST /api/channel-videos
Content-Type: application/json
api-key: S#D$FG%^$#DEF%G^*$%R^T&Y*U

{
    "id": "channel_id",
    "page": 1
}
```

### Channel Live Videos
```http
POST /api/channel-live-videos
Content-Type: application/json
api-key: S#D$FG%^$#DEF%G^*$%R^T&Y*U

{
    "id": "channel_id",
    "page": 1
}
```

### Playlist Videos
```http
POST /api/playlist
Content-Type: application/json
api-key: S#D$FG%^$#DEF%G^*$%R^T&Y*U

{
    "id": "playlist_id",
    "page": 1
}
```

### Video Transcript
```http
POST /api/transcript
Content-Type: application/json
api-key: S#D$FG%^$#DEF%G^*$%R^T&Y*U

{
    "id": "video_id",
    "type": "timestamped",
    "lang": "en"
}
```

### Channel Details
```http
POST /api/channel-details
Content-Type: application/json
api-key: S#D$FG%^$#DEF%G^*$%R^T&Y*U

{
    "id": "channel_id"
}
```

### Video Languages
```http
GET /api/video-languages?id=video_id
api-key: S#D$FG%^$#DEF%G^*$%R^T&Y*U
```

## Development Setup

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Run development server:
```bash
docker-compose up app
```

4. Run tests:
```bash
docker-compose run test
```

## Production Deployment

The application is containerized and can be deployed using Docker.

### Using Docker Compose (Recommended)

1. Build and start the production server:
```bash
docker-compose up -d prod
```

2. The server will:
   - Run on port 3000
   - Automatically restart on failures
   - Include health monitoring
   - Rotate logs
   - Manage resource usage

### Manual Docker Deployment

1. Build the production image:
```bash
docker build --target prod -t youtubei-api:prod .
```

2. Run the container:
```bash
docker run -d -p 3000:3000 -e NODE_ENV=production youtubei-api:prod
```

## Container Management

### View Logs
```bash
docker-compose logs -f prod
```

### Check Status
```bash
docker-compose ps
```

### Stop Server
```bash
docker-compose stop prod
```

### Restart Server
```bash
docker-compose restart prod
```

### Check Container Health
```bash
docker inspect --format='{{json .State.Health}}' youtubei-api-prod
```

### Monitor Resource Usage
```bash
docker stats youtubei-api-prod
```

## Configuration

The production environment includes:

- Automatic restart policy
- Health checks every 30 seconds
- Resource limits:
  - CPU: max 1 core, min 0.25 core
  - Memory: max 1GB, min 512MB
- Log rotation:
  - Maximum 10MB per file
  - Keeps last 3 log files

## Testing

Run the test suite:
```bash
docker-compose run test
```

## License

MIT
