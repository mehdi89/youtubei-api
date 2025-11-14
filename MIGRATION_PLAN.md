# YouTubei to yt-dlp Migration Plan

## Overview
Replace the npm `youtubei` package with `yt-dlp` while maintaining 100% API compatibility. This is a drop-in replacement - all request/response formats must remain identical.

## Architecture Design

### Current Architecture
```
Next.js API Routes → youtubei (npm) → YouTube
```

### New Architecture
```
Next.js API Routes → Python Wrapper → yt-dlp → YouTube
```

### Python Wrapper Service
Create a Python service that:
1. Accepts commands via child_process from Node.js
2. Executes yt-dlp with appropriate flags
3. Transforms yt-dlp JSON output to match youtubei format exactly
4. Returns formatted JSON to Node.js

### Communication Method
- **Option 1 (Chosen)**: Child process with JSON stdin/stdout
- Simple, no network overhead, works in Docker
- Node.js spawns Python process per request or uses persistent process pool

## yt-dlp Capabilities Mapping

### Video Details
```bash
yt-dlp --dump-json --write-auto-sub --skip-download <video_url>
```
Returns comprehensive JSON with:
- Video metadata (title, description, duration, views, likes)
- Channel info (id, name, subscribers, thumbnails)
- Chapters, upload date, live status
- Automatic subtitles/captions data

### Subtitles/Transcripts
```bash
yt-dlp --list-subs <video_url>          # List available languages
yt-dlp --write-auto-sub --sub-lang en --skip-download <video_url>  # Download specific language
```

### Search
yt-dlp doesn't support search directly, but we can use:
```bash
yt-dlp ytsearch10:"query" --dump-json --skip-download
yt-dlp ytsearchall:"query" --max-downloads 50 --dump-json --skip-download
```

### Channel Videos
```bash
yt-dlp --flat-playlist --dump-json <channel_url>/videos
yt-dlp --flat-playlist --dump-json <channel_url>/live
```

### Playlist
```bash
yt-dlp --flat-playlist --dump-json <playlist_url>
```

### Channel Details
```bash
yt-dlp --dump-json --playlist-items 0 <channel_url>  # Gets channel metadata
```

## Implementation Plan

### Phase 1: Setup & Architecture (Tasks 1-4)
1. **Test current endpoints** - Establish baseline with real YouTube data
   - Test video: `dQw4w9WgXcQ` (Rick Astley - Never Gonna Give You Up)
   - Test channel: `UCuAXFkgsw1L7xaCfnd5JJOw` (Rick Astley)
   - Test playlist: `PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf` (Popular)
   - Document exact responses

2. **Design Python wrapper architecture**
   - Create `src/utils/ytdlp-wrapper.py` - Main Python service
   - Create `src/utils/ytdlp-client.js` - Node.js client
   - Define JSON RPC-like protocol for communication

3. **Setup Python environment**
   - Add Python to Dockerfile
   - Create requirements.txt with yt-dlp
   - Test yt-dlp installation

4. **Create Python wrapper service**
   - Implement command handlers for each API type
   - Implement response formatters to match youtubei format
   - Add error handling and logging

### Phase 2: Endpoint Implementation (Tasks 5-12)

For each endpoint:
1. Implement yt-dlp command mapping
2. Transform response to match exact youtubei format
3. Test with same test data
4. Compare responses field-by-field
5. Fix any discrepancies

#### Endpoint Order (by complexity):
1. `/api/video-languages` - Simplest, just list subs
2. `/api/transcript` - Medium, fetch and format transcript
3. `/api/video-details` - Complex, full video data + transcript
4. `/api/channel-details` - Channel metadata
5. `/api/channel` - Simplified channel data
6. `/api/playlist` - Playlist videos
7. `/api/channel-videos` - Channel videos with pagination
8. `/api/channel-live-videos` - Live streams
9. `/api/search` - Most complex, requires special yt-dlp syntax

### Phase 3: Build & Deploy (Tasks 13-17)
1. Update package.json (remove youtubei, add Python deps)
2. Update Dockerfile
3. Run full test suite
4. Verify build process
5. Test Docker deployment

## Response Format Compatibility Matrix

### Critical Fields to Match

#### Video Details Response
```javascript
{
  "id": string,
  "channel": {
    "youtube_channel_id": string,
    "name": string,
    "subscriberCount": string,  // "1.2M" format
    "thumbnails": array,
    "videoCount": number,
    "url": string
  },
  "title": string,
  "chapters": array,
  "description": string,
  "duration": number,  // seconds
  "likeCount": string,  // "10K" format
  "isLiveContent": boolean,
  "uploadDate": string,  // "YYYY-MM-DD"
  "viewCount": string,  // "100K" format
  "transcript": string,  // plain text
  "transcript_status": {
    "available": boolean,
    "reason": string | null
  },
  "timestamped_transcript": string,  // "time: 0 second. Text: ..."
  "timestamped_transcript_array": array,
  "timestamped_transcript_status": {
    "available": boolean,
    "reason": string | null,
    "language": string,
    "available_languages": array
  }
}
```

#### Search Video Response
```javascript
{
  "id": string,
  "title": string,
  "duration": number,
  "description": string,
  "isLive": boolean,
  "viewCount": string,
  "uploadDate": string,
  "thumbnail": string,  // Standard format: https://img.youtube.com/vi/${id}/hqdefault.jpg
  "channelName": string,
  "channelID": string,
  "channelThumbnail": string
}
```

### Format Conversion Requirements

1. **Number Formatting**:
   - Views/Likes/Subs: Convert `1234567` → `"1.2M"`
   - Use K (thousands), M (millions), B (billions)

2. **Duration**:
   - yt-dlp returns seconds as number
   - Must remain as number (not string)

3. **Dates**:
   - yt-dlp: Various formats
   - Required: `"YYYY-MM-DD"`

4. **Thumbnails**:
   - Standardize to: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`

5. **Transcript Format**:
   - Plain: Concatenated text with spaces
   - Timestamped: `"time: 0 second. Text: Hello\ntime: 5 second. Text: World"`
   - HTML entity decoding required

## Testing Strategy

### Baseline Testing (Before Migration)
Test all endpoints with real data and save responses:
```bash
# Create test-data/ directory with baseline responses
curl -X POST http://localhost:3000/api/video-details \
  -H "api-key: $API_KEY" \
  -d '{"id":"dQw4w9WgXcQ","transcript":true}' \
  > test-data/video-details-baseline.json
```

### Comparison Testing (After Migration)
Run same tests and compare responses using JSON diff tools:
```bash
# Compare field-by-field
diff test-data/video-details-baseline.json test-data/video-details-ytdlp.json
```

### Test Cases

#### Video Details
- `dQw4w9WgXcQ` - Standard video with transcript
- `jNQXAC9IVRw` - "Me at the zoo" (first YouTube video)
- Live video (current)
- Video without transcript

#### Search
- Query: "rick astley"
- Type: video, channel, playlist
- Pagination: page 1, 2, 3

#### Channel
- `UCuAXFkgsw1L7xaCfnd5JJOw` - Rick Astley
- Channel with live streams
- Channel with many videos (test pagination)

#### Playlist
- `PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf`
- Test pagination

## Risk Mitigation

### Potential Issues

1. **Rate Limiting**:
   - yt-dlp may have different rate limit behavior
   - Solution: Implement retry logic, use cookies if needed

2. **Transcript Format Differences**:
   - Auto-generated vs manual captions
   - Solution: Test thoroughly, implement format converters

3. **Pagination**:
   - yt-dlp pagination works differently
   - Solution: May need to fetch more and slice client-side

4. **Performance**:
   - Spawning Python processes may be slower
   - Solution: Use persistent process pool or consider HTTP service

5. **Search Limitations**:
   - yt-dlp search may return different results
   - Solution: Test extensively, document any differences

## Rollback Plan

1. Keep youtubei dependency until migration is 100% complete
2. Use feature flag to switch between implementations
3. Run both in parallel during testing phase
4. Only remove youtubei after full verification

## Success Criteria

- ✅ All existing tests pass
- ✅ All endpoints return identical response structure
- ✅ Response times within 20% of current implementation
- ✅ Build process unchanged for end users
- ✅ Docker deployment works
- ✅ No breaking changes to API contract

## Dependencies

### Python Requirements (requirements.txt)
```
yt-dlp>=2024.1.0
```

### System Requirements
- Python 3.8+
- ffmpeg (for certain yt-dlp features)

## Timeline Estimate

- Phase 1 (Setup): 2-3 hours
- Phase 2 (Implementation): 6-8 hours
- Phase 3 (Build/Deploy): 1-2 hours
- **Total**: 9-13 hours

## Notes

- Maintain visual logging indicators (✅ ❌ ⚠️ ℹ️ 🔄)
- Keep all error handling patterns
- Preserve API key authentication
- No changes to CLAUDE.md instructions (API behavior unchanged)
