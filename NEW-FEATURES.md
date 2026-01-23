# New API Features (v2)

This document lists all new features and parameters added to the API after the migration to `youtubei.js`.

## Summary of Changes

| Endpoint | Status | Key New Features |
|----------|--------|------------------|
| `/api/video-details` | ✅ Migrated | Chapters, better error handling |
| `/api/transcript` | ✅ Migrated | Multi-language support |
| `/api/channel-videos` | ✅ Migrated | **`contentType` filter (shorts/videos/live)** |
| `/api/channel-details` | ✅ Migrated | Handle, verification badge, RSS URL |
| `/api/search` | ✅ Migrated | Filters (duration, date), `isShort` field |
| `/api/playlist` | ✅ Migrated | Playlist metadata option |
| `/api/channel-live-videos` | ✅ Migrated | Scheduled streams, viewer count |

---

## Channel Videos API

### New Parameter: `contentType`

Filter channel content by type. **This solves the Shorts vs Videos problem.**

```bash
# Get only regular videos
POST /api/channel-videos
{
  "id": "UCX6OQ3DkcsbYNE6H8uQQuVA",
  "contentType": "videos"
}

# Get only Shorts
POST /api/channel-videos
{
  "id": "UCX6OQ3DkcsbYNE6H8uQQuVA",
  "contentType": "shorts"
}

# Get only live streams
POST /api/channel-videos
{
  "id": "UCX6OQ3DkcsbYNE6H8uQQuVA",
  "contentType": "live"
}

# Get all content (default, backwards compatible)
POST /api/channel-videos
{
  "id": "UCX6OQ3DkcsbYNE6H8uQQuVA",
  "contentType": "all"
}
```

### New Response Field: `isShort`

Every video item now includes an `isShort` boolean:

```json
{
  "id": "wSh8fAFWEWs",
  "title": "Survivor vs Beast Games",
  "isShort": true,
  "duration": null,
  "viewCount": 14000000
}
```

---

## Channel Details API

### New Response Fields

```json
{
  "id": "UCX6OQ3DkcsbYNE6H8uQQuVA",
  "name": "MrBeast",
  "handle": "@MrBeast",              // NEW: Channel handle
  "subscriberCount": "462M subscribers",
  "videosCount": 943,
  "isVerified": true,                // NEW: Verification badge
  "keywords": ["mrbeast6000", "beast"],  // NEW: Channel keywords
  "rssUrl": "https://www.youtube.com/feeds/videos.xml?channel_id=...",  // NEW
  "isFamilySafe": true,              // NEW
  "availableCountryCodes": ["US", "GB", ...]  // NEW
}
```

---

## Search API

### New Parameters

| Parameter | Type | Description | Values |
|-----------|------|-------------|--------|
| `sortBy` | string | Sort results | `relevance`, `date`, `views`, `rating` |
| `duration` | string | Filter by duration (video only) | `short` (<4min), `medium` (4-20min), `long` (>20min) |
| `uploadDate` | string | Filter by upload date (video only) | `hour`, `day`, `week`, `month`, `year` |

### Example with Filters

```bash
POST /api/search
{
  "query": "javascript",
  "type": "video",
  "sortBy": "date",
  "duration": "long",
  "uploadDate": "week"
}
```

### New Response Fields

**Video Results:**
```json
{
  "id": "...",
  "title": "...",
  "isShort": false,           // NEW: Identifies Shorts in search
  "badges": ["4K", "CC"]      // NEW: Video badges
}
```

**Channel Results:**
```json
{
  "id": "...",
  "title": "...",
  "handle": "@ChannelName",   // NEW
  "isVerified": true          // NEW
}
```

---

## Playlist API

### New Parameter: `includeMetadata`

Get playlist metadata along with videos:

```bash
POST /api/playlist
{
  "id": "PLRqwX-V7Uu6ZF9C0YMKuns9sLDzK6zoiV",
  "includeMetadata": true
}
```

### New Response Format (with metadata)

```json
{
  "playlist": {
    "id": "PLRqwX-V7Uu6ZF9C0YMKuns9sLDzK6zoiV",
    "title": "Git and GitHub for Poets",
    "description": "...",
    "videoCount": 10,
    "viewCount": 1234567,
    "lastUpdated": "Updated 3 months ago",
    "author": {
      "name": "The Coding Train",
      "id": "UCvjgXvBlbQiAffgfV4Xp36w",
      "thumbnail": "..."
    }
  },
  "videos": [...],
  "hasMore": true
}
```

### New Video Fields

```json
{
  "id": "...",
  "index": 1,           // NEW: Position in playlist
  "isPlayable": true    // NEW: Whether video is available
}
```

---

## Channel Live Videos API

### New Response Fields

```json
{
  "id": "...",
  "title": "...",
  "isLive": true,
  "watchingCount": 12500,      // NEW: Concurrent viewers
  "scheduledTime": "Dec 25",   // NEW: For scheduled streams
  "isUpcoming": false          // NEW: Identifies scheduled streams
}
```

---

## Migration Notes for Apps

### Backwards Compatibility

All new fields are **additive**. Existing integrations will continue to work without changes.

### Recommended Updates

1. **Channel Videos Screen**: Add UI toggle for Videos/Shorts/Live tabs
2. **Search Screen**: Add filter dropdowns for duration, upload date, sort
3. **Channel Details Screen**: Display verification badge, handle
4. **Playlist Screen**: Show playlist metadata in header

### Example: Filtering Shorts in Mobile App

```javascript
// Before (unreliable)
const isShort = video.duration < 60;

// After (accurate)
const isShort = video.isShort === true;

// Or fetch only shorts
const shorts = await api.channelVideos({ id, contentType: 'shorts' });
```

---

## API Version Header

Responses now include a version header:

```
X-API-Version: 2.0
```

---

## Deprecation Notices

None. All existing parameters remain supported.
