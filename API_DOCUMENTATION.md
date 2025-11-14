# YouTubei API Documentation

## Overview

This is a Next.js-based REST API that wraps the YouTubei library to provide YouTube data access including video details, transcripts, channel information, and search functionality. The API is designed to be a lightweight alternative to YouTube's official Data API.

## Technical Stack

- **Framework**: Next.js 15.3.3 with React 19
- **Runtime**: Node.js 16+
- **Core Library**: youtubei v1.7.0
- **Transcript**: Custom youtube-transcript submodule
- **HTTP Client**: Axios (for transcript fetching)
- **Testing**: Jest with node-mocks-http

## Authentication

All API endpoints require an `api-key` header that matches the `YOUTUBE_API_KEY` environment variable.

```bash
# Example request with authentication
curl -X POST http://localhost:3000/api/endpoint \
  -H "Content-Type: application/json" \
  -H "api-key: YOUR_API_KEY" \
  -d '{"param": "value"}'
```

## API Endpoints

### 1. Video Details
**Endpoint**: `POST /api/video-details`

Fetches comprehensive metadata about a YouTube video, optionally including transcript.

**Request Body**:
```json
{
  "id": "dQw4w9WgXcQ",        // Required: YouTube video ID
  "includeTranscript": true    // Optional: Include transcript (default: false)
}
```

**Response**:
```json
{
  "id": "dQw4w9WgXcQ",
  "title": "Rick Astley - Never Gonna Give You Up",
  "description": "Full video description...",
  "duration": "3:33",
  "uploadDate": "2009-10-25",
  "viewCount": 1234567890,
  "likeCount": 12345678,
  "isLive": false,
  "channel": {
    "id": "UCuAXFkgsw1L7xaCfnd5JJOw",
    "name": "Rick Astley",
    "subscriberCount": "3.5M"
  },
  "thumbnail": "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
  "availableQualities": ["1080p", "720p", "480p", "360p", "240p", "144p"],
  "category": "Music",
  "tags": ["rick astley", "never gonna give you up", "80s"],
  "transcript": "We're no strangers to love..."  // If includeTranscript: true
}
```

### 2. Video Transcript
**Endpoint**: `POST /api/transcript`

Fetches video transcript in various formats.

**Request Body**:
```json
{
  "videoId": "dQw4w9WgXcQ",      // Required: YouTube video ID
  "lang": "en",                   // Optional: Language code (default: "en")
  "format": "plain"               // Optional: "plain" or "timestamped" (default: "plain")
}
```

**Response (plain format)**:
```json
{
  "transcript": "We're no strangers to love You know the rules and so do I..."
}
```

**Response (timestamped format)**:
```json
{
  "transcript": [
    {
      "text": "We're no strangers to love",
      "duration": 3000,
      "offset": 0
    },
    {
      "text": "You know the rules and so do I",
      "duration": 2500,
      "offset": 3000
    }
  ]
}
```

### 3. Video Languages
**Endpoint**: `POST /api/video-languages`

Gets available transcript languages for a video.

**Request Body**:
```json
{
  "videoId": "dQw4w9WgXcQ"      // Required: YouTube video ID
}
```

**Response**:
```json
{
  "languages": [
    {
      "language": "English",
      "language_code": "en"
    },
    {
      "language": "Spanish",
      "language_code": "es"
    }
  ]
}
```

### 4. Search
**Endpoint**: `POST /api/search`

Search for videos, channels, or playlists on YouTube.

**Request Body**:
```json
{
  "query": "never gonna give you up",   // Required: Search query
  "type": "video",                      // Optional: "video", "channel", "playlist", "all" (default: "video")
  "limit": 20                           // Optional: Max results (default: 20)
}
```

**Response**:
```json
{
  "items": [
    {
      "id": "dQw4w9WgXcQ",
      "title": "Rick Astley - Never Gonna Give You Up",
      "type": "video",
      "duration": "3:33",
      "viewCount": "1.2B",
      "uploadDate": "13 years ago",
      "thumbnail": "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      "channel": {
        "id": "UCuAXFkgsw1L7xaCfnd5JJOw",
        "name": "Rick Astley"
      }
    }
  ]
}
```

### 5. Channel Details
**Endpoint**: `POST /api/channel-details`

Gets detailed information about a YouTube channel.

**Request Body**:
```json
{
  "id": "UCuAXFkgsw1L7xaCfnd5JJOw"     // Required: Channel ID or handle
}
```

**Response**:
```json
{
  "id": "UCuAXFkgsw1L7xaCfnd5JJOw",
  "name": "Rick Astley",
  "handle": "@RickAstley",
  "description": "Official Rick Astley YouTube Channel...",
  "subscriberCount": "3.5M subscribers",
  "videoCount": "123",
  "thumbnails": {
    "default": "https://yt3.ggpht.com/...",
    "banner": "https://yt3.ggpht.com/..."
  }
}
```

### 6. Channel Videos (with Tab Support)
**Endpoint**: `POST /api/channel-videos`

Gets videos, shorts, streams, or playlists from a channel.

**Request Body**:
```json
{
  "id": "UCuAXFkgsw1L7xaCfnd5JJOw",    // Required: Channel ID or handle
  "page": 1,                            // Optional: Page number for pagination
  "tab": "videos"                       // Optional: "videos", "shorts", "streams", "playlists" (default: "videos")
}
```

**Response (videos/streams)**:
```json
[
  {
    "id": "dQw4w9WgXcQ",
    "title": "Never Gonna Give You Up",
    "duration": "3:33",
    "description": "The official video...",
    "isLive": false,
    "viewCount": "1234567890",
    "uploadDate": "2009-10-25",
    "thumbnail": "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    "channelName": "Rick Astley",
    "channelID": "UCuAXFkgsw1L7xaCfnd5JJOw"
  }
]
```

**Response (playlists - when working)**:
```json
[
  {
    "id": "PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf",
    "title": "Best of Rick Astley",
    "videoCount": "25",
    "thumbnail": "https://img.youtube.com/vi/.../hqdefault.jpg",
    "channelName": "Rick Astley",
    "channelID": "UCuAXFkgsw1L7xaCfnd5JJOw"
  }
]
```

**Response (shorts/playlists - current limitation)**:
```json
{
  "items": [],
  "notice": "YouTube Shorts/Playlists fetching is currently not supported due to a known issue in the youtubei library (v1.7.0). See: https://github.com/SuspiciousLookingOwl/youtubei/issues/122"
}
```

### 7. Channel Live Videos
**Endpoint**: `POST /api/channel-live-videos`

Gets live and upcoming streams from a channel.

**Request Body**:
```json
{
  "id": "UCuAXFkgsw1L7xaCfnd5JJOw",    // Required: Channel ID or handle
  "page": 1                             // Optional: Page number
}
```

**Response**: Same format as channel-videos endpoint with `isLive: true`

### 8. Playlist Videos
**Endpoint**: `POST /api/playlist`

Gets videos from a YouTube playlist.

**Request Body**:
```json
{
  "id": "PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf",  // Required: Playlist ID
  "page": 1                                      // Optional: Page number
}
```

**Response**:
```json
{
  "title": "Best of Rick Astley",
  "videoCount": 25,
  "channelName": "Rick Astley",
  "channelID": "UCuAXFkgsw1L7xaCfnd5JJOw",
  "videos": [
    {
      "id": "dQw4w9WgXcQ",
      "title": "Never Gonna Give You Up",
      "duration": "3:33",
      "thumbnail": "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      "channelName": "Rick Astley",
      "channelID": "UCuAXFkgsw1L7xaCfnd5JJOw"
    }
  ]
}
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "message": "Error description"
}
```

**Common HTTP Status Codes**:
- `401` - Invalid API key
- `400` - Bad request (missing required parameters)
- `404` - Resource not found (video/channel/playlist)
- `405` - Method not allowed (non-POST request)
- `500` - Internal server error

## Known Limitations

1. **YouTube Shorts**: Not supported due to youtubei library bug #122
2. **Channel Playlists**: Not supported due to youtubei library bug #122
3. **Pagination**: Inconsistent for some content types
4. **Live Chat**: Not implemented
5. **Comments**: Not implemented
6. **Video Download URLs**: Not provided (intentionally)

## Environment Configuration

Create a `.env` file in the project root:

```env
YOUTUBE_API_KEY=your_secure_api_key_here
```

## Project Structure

```
youtubei-api/
├── src/
│   ├── pages/
│   │   └── api/
│   │       ├── video-details.js
│   │       ├── transcript.js
│   │       ├── video-languages.js
│   │       ├── search.js
│   │       ├── channel-details.js
│   │       ├── channel-videos.js
│   │       ├── channel-live-videos.js
│   │       ├── playlist.js
│   │       └── __tests__/
│   │           ├── video-details.test.js
│   │           ├── search.test.js
│   │           └── channel-videos.test.js
│   └── utils/
│       ├── youtubei.js          # Configured YouTube client
│       ├── logger.js            # Logging utility
│       └── youtube-transcript/   # Transcript submodule
├── .env                          # Environment variables
├── package.json
├── jest.config.js
└── CLAUDE.md                     # AI assistant instructions
```

## Logging System

The API uses a visual logging system with colored indicators:
- ✅ SUCCESS - Operation completed successfully
- ❌ ERROR - Operation failed
- ⚠️ WARN - Warning or non-critical issue
- ℹ️ INFO - Informational message
- 🔄 FETCH - Data fetching operation

## Running the Project

### Development
```bash
npm install
npm run dev
# Server starts on http://localhost:3000
```

### Production
```bash
npm run build
npm start
```

### Testing
```bash
npm test                 # Run all tests
npm test:watch          # Run tests in watch mode
npm test:coverage       # Generate coverage report
```

### Docker
```bash
docker compose build prod
docker compose up -d prod
docker compose logs -f prod
```

## Implementation Notes for yt-dlp Migration

To reproduce this API using yt-dlp, you'll need to:

### 1. Video Details
```bash
yt-dlp --dump-json "https://youtube.com/watch?v=VIDEO_ID"
```
Parse JSON output for title, description, duration, views, likes, channel info, etc.

### 2. Transcript
```bash
yt-dlp --write-subs --sub-lang en --skip-download "https://youtube.com/watch?v=VIDEO_ID"
```
Parse the downloaded .vtt or .srt file for transcript content.

### 3. Channel Videos
```bash
yt-dlp --flat-playlist -J "https://youtube.com/@CHANNEL/videos"
```
Parse JSON for video list. For tabs (shorts/streams/playlists):
- Shorts: `https://youtube.com/@CHANNEL/shorts`
- Streams: `https://youtube.com/@CHANNEL/streams`
- Playlists: `https://youtube.com/@CHANNEL/playlists`

### 4. Search
```bash
yt-dlp "ytsearch20:SEARCH_QUERY" --flat-playlist -J
```
Parse JSON for search results.

### 5. Playlist
```bash
yt-dlp --flat-playlist -J "https://youtube.com/playlist?list=PLAYLIST_ID"
```
Parse JSON for playlist videos.

### Key Differences from YouTubei

1. **Performance**: yt-dlp may be slower as it scrapes HTML/uses extractors
2. **Reliability**: yt-dlp is more actively maintained and handles YouTube changes better
3. **Features**: yt-dlp supports downloading, which this API intentionally doesn't expose
4. **Shorts/Playlists**: yt-dlp should handle these correctly unlike current youtubei v1.7.0

### Recommended yt-dlp Options

```python
ydl_opts = {
    'quiet': True,
    'no_warnings': True,
    'extract_flat': True,  # For playlists/channels
    'skip_download': True,
    'writesubtitles': True,  # For transcripts
    'subtitleslangs': ['en'],
    'format': 'best',
    'ignoreerrors': True,
    'no_check_certificate': True,
    'preferredcodec': 'mp4'
}
```

## Security Considerations

1. **API Key**: Store securely in environment variables, never commit to repository
2. **Rate Limiting**: Implement rate limiting to prevent abuse
3. **Input Validation**: Validate all user inputs (video IDs, channel IDs, etc.)
4. **CORS**: Configure appropriate CORS headers for production
5. **Timeout**: Set appropriate timeouts for YouTube requests
6. **Caching**: Implement caching to reduce YouTube API calls

## Performance Optimizations

1. **Caching**: Cache frequently requested data (channel info, popular videos)
2. **Pagination**: Use pagination for large result sets
3. **Concurrent Requests**: Batch multiple requests when possible
4. **Connection Pooling**: Reuse HTTP connections
5. **Response Compression**: Enable gzip compression

## Monitoring

Recommended metrics to track:
- API response times
- Error rates by endpoint
- YouTube API failures
- Cache hit rates
- Request volume by endpoint

## Future Enhancements

1. Implement WebSocket support for real-time updates
2. Add GraphQL endpoint for flexible queries
3. Implement comment fetching
4. Add channel statistics over time
5. Support for YouTube Music
6. Implement proper caching layer (Redis)
7. Add rate limiting per API key
8. Implement webhook support for channel updates

## Contributing

1. Follow existing code style and patterns
2. Add tests for new endpoints
3. Update documentation for API changes
4. Use semantic commit messages
5. Ensure all tests pass before submitting PR

## License

This project is for educational purposes. Ensure compliance with YouTube's Terms of Service when deploying to production.