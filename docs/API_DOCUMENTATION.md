# YouTube API Documentation

## API Endpoints and Request/Response Formats

This document provides the complete API specification for all endpoints, maintained for backward compatibility with the previous Node.js implementation.

### Base URL
- Production: `http://yt-api.moneybag.com.bd`
- Local: `http://localhost:3000`

### Authentication
All endpoints (except `/api/hello`) require an API key in the header:
```
api-key: YOUR_API_KEY
```

---

## Endpoints

### 1. Health Check
**GET** `/api/hello`

No authentication required.

**Response:**
```json
{
  "message": "Hello from YouTube API",
  "cookies_enabled": true
}
```

---

### 2. Video Details
**POST** `/api/video-details`

Get comprehensive video information including metadata and optional transcript.

**Request Body:**
```json
{
  "id": "VIDEO_ID",
  "transcript": false,
  "timestamped": false
}
```

**Parameters:**
- `id` (string, required): YouTube video ID
- `transcript` (boolean, optional): Include plain text transcript (default: false)
- `timestamped` (boolean, optional): Include timestamped transcript array (default: false)

**Response Example:**
```json
{
  "id": "NGlX-1jhYJE",
  "channel": {
    "id": "UCkWQ0gDrK9yn7h_WI8YVo7A",
    "youtube_channel_id": "UCkWQ0gDrK9yn7h_WI8YVo7A",
    "name": "Fireship",
    "subscriberCount": "3.54M subscribers",
    "thumbnails": [
      {
        "url": "https://yt3.ggpht.com/..."
      }
    ],
    "videoCount": 0,
    "url": "https://www.youtube.com/channel/UCkWQ0gDrK9yn7h_WI8YVo7A"
  },
  "title": "Google I/O 2025 in 100 Seconds",
  "chapters": [],
  "description": "Google I/O 2025 just happened...",
  "duration": 150,
  "likeCount": 125000,
  "isLiveContent": false,
  "uploadDate": "2025-05-14",
  "viewCount": 5145221,
  "transcript": "Full transcript text...",
  "transcript_status": {
    "available": true,
    "reason": null
  },
  "timestamped_transcript": "time : 0.0 second. Text: Hey...",
  "timestamped_transcript_array": [
    {
      "text": "Hey there, it's Google I/O 2025",
      "offset": 0.0,
      "duration": 2.5
    }
  ],
  "timestamped_transcript_status": {
    "available": true,
    "reason": null,
    "language": "en",
    "available_languages": ["en", "es", "fr"]
  }
}
```

---

### 3. Video Transcript
**POST** `/api/transcript`

Get video transcript in plain or timestamped format.

**Request Body:**
```json
{
  "id": "VIDEO_ID",
  "type": "plain"
}
```

**Parameters:**
- `id` (string, required): YouTube video ID
- `type` (string, optional): "plain" or "timestamped" (default: "plain")

**Response Example:**
```json
{
  "data": "Full transcript text with all segments concatenated..."
}
```

---

### 4. Available Languages
**POST** `/api/video-languages`

Get list of available caption languages for a video.

**Request Body:**
```json
{
  "id": "VIDEO_ID"
}
```

**Response Example:**
```json
[
  {
    "languageCode": "en",
    "name": "English"
  },
  {
    "languageCode": "es",
    "name": "Spanish"
  },
  {
    "languageCode": "fr",
    "name": "French"
  }
]
```

---

### 5. Search
**POST** `/api/search`

Search YouTube for videos, channels, or playlists.

**Request Body:**
```json
{
  "query": "python tutorial",
  "type": "video",
  "page": 1
}
```

**Parameters:**
- `query` (string, required): Search query
- `type` (string, optional): "video", "channel", or "playlist" (default: "video")
- `page` (integer, optional): Page number for pagination (default: 1, 30 items per page)

**Response Example:**
```json
[
  {
    "id": "kqtD5dpn9C8",
    "title": "Python Tutorial for Beginners",
    "duration": 3600,
    "description": "Learn Python in one video...",
    "isLive": false,
    "viewCount": "1500000",
    "uploadDate": "2024-01-15",
    "thumbnail": "https://img.youtube.com/vi/kqtD5dpn9C8/hqdefault.jpg"
  }
]
```

---

### 6. Channel Details
**POST** `/api/channel-details` or `/api/channel`

Get channel information.

**Request Body:**
```json
{
  "id": "CHANNEL_ID"
}
```

**Parameters:**
- `id` (string, required): YouTube channel ID or handle (e.g., "UCkWQ0gDrK9yn7h_WI8YVo7A" or "@Fireship")

**Response Example:**
```json
{
  "id": "UCkWQ0gDrK9yn7h_WI8YVo7A",
  "youtube_channel_id": "UCkWQ0gDrK9yn7h_WI8YVo7A",
  "name": "Fireship",
  "description": "High-intensity ⚡ code tutorials...",
  "isVerified": true,
  "subscriberCount": "3.54M subscribers",
  "thumbnail": "https://yt3.ggpht.com/...",
  "banner": "",
  "joinedDate": "",
  "location": "",
  "videosCount": 0,
  "viewCount": "250000000",
  "keywords": [],
  "isFamilySafe": true,
  "availableCountryCodes": []
}
```

---

### 7. Channel Videos
**POST** `/api/channel-videos`

Get videos from a channel with pagination.

**Request Body:**
```json
{
  "id": "CHANNEL_ID",
  "page": 1
}
```

**Parameters:**
- `id` (string, required): YouTube channel ID or handle
- `page` (integer, optional): Page number (default: 1, 30 items per page)

**Response Example:**
```json
[
  {
    "id": "NGlX-1jhYJE",
    "title": "Google I/O 2025 in 100 Seconds",
    "duration": 150,
    "description": "Google I/O 2025 just happened...",
    "isLive": false,
    "viewCount": "5145221",
    "uploadDate": "2025-05-14",
    "thumbnail": "https://img.youtube.com/vi/NGlX-1jhYJE/hqdefault.jpg",
    "channelName": "Fireship",
    "channelID": "UCkWQ0gDrK9yn7h_WI8YVo7A"
  }
]
```

---

### 8. Channel Live Videos
**POST** `/api/channel-live-videos`

Get currently live streams from a channel.

**Request Body:**
```json
{
  "id": "CHANNEL_ID"
}
```

**Response Example:**
```json
[
  {
    "id": "LIVE_VIDEO_ID",
    "title": "Live Stream Title",
    "duration": 0,
    "description": "Description...",
    "isLive": true,
    "viewCount": "1234",
    "uploadDate": "2025-05-15",
    "thumbnail": "https://img.youtube.com/vi/LIVE_VIDEO_ID/hqdefault.jpg",
    "channelName": "Channel Name",
    "channelID": "CHANNEL_ID"
  }
]
```

---

### 9. Playlist Videos
**POST** `/api/playlist`

Get videos from a playlist with pagination.

**Request Body:**
```json
{
  "id": "PLAYLIST_ID",
  "page": 1
}
```

**Parameters:**
- `id` (string, required): YouTube playlist ID
- `page` (integer, optional): Page number (default: 1, 30 items per page)

**Response Example:**
```json
[
  {
    "id": "kqtD5dpn9C8",
    "title": "Video Title",
    "duration": 600,
    "description": "Description...",
    "isLive": false,
    "viewCount": "100000",
    "uploadDate": "2024-03-20",
    "thumbnail": "https://img.youtube.com/vi/kqtD5dpn9C8/hqdefault.jpg",
    "channelName": "Channel Name",
    "channelID": "UCxxxxx"
  }
]
```

---

## Error Responses

All endpoints follow consistent error response format:

**401 Unauthorized:**
```json
{
  "message": "Invalid API key"
}
```

**403 Forbidden:**
```json
{
  "message": "YouTube bot detection - cookies may be expired"
}
```

**404 Not Found:**
```json
{
  "message": "Video not found or may have been removed"
}
```

**500 Internal Server Error:**
```json
{
  "message": "Internal Server Error"
}
```

---

## Notes

### Data Type Specifications
- **viewCount**: Integer (e.g., `5145221`)
- **likeCount**: Integer (e.g., `125000`)
- **subscriberCount**: String with suffix (e.g., `"3.54M subscribers"`)
- **duration**: Integer in seconds
- **uploadDate**: String in YYYY-MM-DD format
- **isLiveContent**: Boolean
- **isLive**: Boolean

### Pagination
- All paginated endpoints return 30 items per page
- Page numbers start from 1
- Empty arrays are returned when no more items are available

### Transcript Features
- Plain transcripts are concatenated text with spaces
- Timestamped transcripts include offset (seconds) and duration
- Multiple language support with automatic fallback to available languages
- Transcript availability is indicated in `transcript_status` object

### YouTube Cookie Support
The API uses YouTube cookies to bypass bot detection. Cookies are automatically loaded from `youtube_cookies.txt` if present in the application root directory.

