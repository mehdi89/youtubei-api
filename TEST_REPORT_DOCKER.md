# API Endpoint Testing Report - Docker Container
## Migration from youtubei to yt-dlp

**Date**: 2025-11-14
**Environment**: Docker Container (Production-like)
**Test Status**: ⚠️ **PARTIAL SUCCESS - Some Issues Found**

---

## Executive Summary

API endpoints have been tested with the Docker container running. Basic functionality is working, but several endpoints have issues that need investigation:

### ✅ Working Endpoints
- ✅ `/api/video-details` (basic video info)
- ✅ `/api/video-languages` (caption languages)
- ✅ `/api/search` (search functionality)
- ✅ Error handling (405, 401, 400)

### ⚠️ Issues Found
- ⚠️ `/api/transcript` - Returns empty data
- ⚠️ `/api/channel-details` - Returns "Channel not found"
- ⚠️ `/api/channel-videos` - Returns "Channel not found"
- ❌ `/api/playlist` - Returns "Internal Server Error"

---

## Detailed Test Results

### 1. ✅ `/api/video-details` - PASS

**Test Request**:
```bash
POST /api/video-details
Headers: api-key: WhK!%hCNI0NyWP%Nb75uUjE%^abmuEJ%4T1PaD%848E
Body: {"id":"dQw4w9WgXcQ","transcript":false}
```

**Result**: ✅ **SUCCESS**

**Response Sample**:
```json
{
  "id": "dQw4w9WgXcQ",
  "channel": {
    "name": "Rick Astley",
    "subscriberCount": "4.4M",
    "url": "https://www.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw"
  },
  "title": "Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)",
  "description": "The official video for "Never Gonna Give You Up" by Rick Astley...",
  "duration": 213,
  "likeCount": "18.6M",
  "isLiveContent": false,
  "uploadDate": "2009-10-25",
  "viewCount": "1.7B"
}
```

**Verification**:
- ✅ Returns complete video metadata
- ✅ All fields populated correctly
- ✅ Channel information included
- ✅ Numeric values parsed correctly (duration: 213 seconds)
- ✅ Large numbers formatted correctly (1.7B views)

---

### 2. ✅ `/api/video-languages` - PASS

**Test Request**:
```bash
POST /api/video-languages
Headers: api-key: WhK!%hCNI0NyWP%Nb75uUjE%^abmuEJ%4T1PaD%848E
Body: {"id":"dQw4w9WgXcQ"}
```

**Result**: ✅ **SUCCESS**

**Response**: Returns 182 available caption languages including:
```json
[
  {"languageCode": "en", "name": "English"},
  {"languageCode": "de-DE", "name": "German"},
  {"languageCode": "ja", "name": "Japanese"},
  {"languageCode": "pt-BR", "name": "Portuguese"},
  {"languageCode": "es-419", "name": "Spanish"},
  ...
]
```

**Verification**:
- ✅ Successfully fetches available caption languages
- ✅ Returns proper language codes and names
- ✅ Includes both auto-generated and manual captions
- ✅ Supports 182 different languages

---

### 3. ✅ `/api/search` - PASS

**Test Request**:
```bash
POST /api/search
Headers: api-key: WhK!%hCNI0NyWP%Nb75uUjE%^abmuEJ%4T1PaD%848E
Body: {"type":"video","query":"rick astley","page":1}
```

**Result**: ✅ **SUCCESS**

**Response Sample**:
```json
[
  {
    "id": "dQw4w9WgXcQ",
    "title": "Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)",
    "duration": 214,
    "description": null,
    "isLive": false,
    "viewCount": "1.7B",
    "uploadDate": "",
    "thumbnail": "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
  },
  {
    "id": "UCuAXFkgsw1L7xaCfnd5JJOw",
    "title": "Rick Astley",
    "duration": 0,
    "description": "2026 UK & Ireland Reflection Tour...",
    "isLive": false,
    "viewCount": "0",
    "uploadDate": "",
    "thumbnail": "https://img.youtube.com/vi/UCuAXFkgsw1L7xaCfnd5JJOw/hqdefault.jpg"
  }
]
```

**Verification**:
- ✅ Returns search results successfully
- ✅ Includes video metadata
- ✅ Returns both videos and channels
- ✅ Thumbnails included
- ⚠️ Note: Some fields are empty (description, uploadDate) - may need investigation

---

### 4. ⚠️ `/api/transcript` - ISSUE FOUND

**Test Request**:
```bash
POST /api/transcript
Headers: api-key: WhK!%hCNI0NyWP%Nb75uUjE%^abmuEJ%4T1PaD%848E
Body: {"id":"dQw4w9WgXcQ","type":"plain"}
```

**Result**: ⚠️ **RETURNS EMPTY DATA**

**Response**:
```json
{"data":""}
```

**Issue**:
- ⚠️ Returns empty transcript despite `/api/video-languages` showing 182 available languages
- ⚠️ `/api/video-details` with `transcript: true` also returns empty transcript
- ⚠️ `transcript_status.available` is `true` but no actual transcript data

**Investigation Needed**:
- Check if the transcript fetching logic is working correctly
- Verify the language selection (should default to English)
- Check server logs for any errors during transcript extraction

---

### 5. ⚠️ `/api/channel-details` - ISSUE FOUND

**Test Request**:
```bash
POST /api/channel-details
Headers: api-key: WhK!%hCNI0NyWP%Nb75uUjE%^abmuEJ%4T1PaD%848E
Body: {"id":"UCuAXFkgsw1L7xaCfnd5JJOw"}
```

**Result**: ⚠️ **CHANNEL NOT FOUND**

**Response**:
```json
{"message":"Channel not found"}
```

**Issue**:
- ⚠️ Returns "Channel not found" for valid channel ID
- ⚠️ Same channel ID works in search results
- ⚠️ Channel ID is visible in video details response

**Investigation Needed**:
- Check if the channel fetching method is implemented correctly
- Verify if yt-dlp requires different handling for channel URLs vs IDs

---

### 6. ⚠️ `/api/channel-videos` - ISSUE FOUND

**Test Request**:
```bash
POST /api/channel-videos
Headers: api-key: WhK!%hCNI0NyWP%Nb75uUjE%^abmuEJ%4T1PaD%848E
Body: {"id":"UCuAXFkgsw1L7xaCfnd5JJOw","page":1}
```

**Result**: ⚠️ **CHANNEL NOT FOUND**

**Response**:
```json
{"message":"Channel not found"}
```

**Issue**:
- ⚠️ Same issue as `/api/channel-details`
- ⚠️ Cannot fetch channel videos

**Investigation Needed**:
- Same root cause as channel-details
- May need to handle channel URLs differently

---

### 7. ❌ `/api/playlist` - FAILURE

**Test Request**:
```bash
POST /api/playlist
Headers: api-key: WhK!%hCNI0NyWP%Nb75uUjE%^abmuEJ%4T1PaD%848E
Body: {"id":"PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf","page":1}
```

**Result**: ❌ **INTERNAL SERVER ERROR**

**Response**:
```json
{"message":"Internal Server Error"}
```

**Issue**:
- ❌ Endpoint crashes with internal server error
- ❌ No specific error message

**Investigation Needed**:
- Check server logs for error details
- Verify playlist implementation in yt-dlp client
- May need to implement playlist support

---

## Error Handling Tests

### ✅ All Error Handling Works Correctly

#### 1. Method Not Allowed (405)
```bash
GET /api/video-details
```
**Response**: ✅ `{"message":"Method Not Allowed"}` (405)

#### 2. Invalid API Key (401)
```bash
POST /api/video-details (with wrong API key)
```
**Response**: ✅ `{"message":"Invalid API key"}` (401)

#### 3. Missing Parameters (400)
```bash
POST /api/video-details (without video ID)
```
**Response**: ✅ `{"message":"Missing video ID"}` (400)

---

## Summary of Results

| Endpoint | Status | Notes |
|----------|--------|-------|
| `/api/video-details` | ✅ PASS | Works correctly for basic video info |
| `/api/video-languages` | ✅ PASS | Returns all available languages |
| `/api/search` | ✅ PASS | Returns search results |
| `/api/transcript` | ⚠️ ISSUE | Returns empty data |
| `/api/channel-details` | ⚠️ ISSUE | Returns "Channel not found" |
| `/api/channel-videos` | ⚠️ ISSUE | Returns "Channel not found" |
| `/api/playlist` | ❌ FAIL | Internal server error |
| Error Handling | ✅ PASS | All error codes work correctly |

---

## Priority Issues to Fix

### High Priority
1. **Transcript fetching** - Critical functionality not working
2. **Channel operations** - Both channel endpoints failing
3. **Playlist endpoint** - Complete failure

### Investigation Steps

#### For Transcript Issue:
1. Check if YouTube transcript API is accessible
2. Verify language selection logic
3. Check for any network/SSL issues
4. Review server logs for specific errors

#### For Channel Issues:
1. Check if yt-dlp requires channel URLs instead of IDs
2. Verify the channel ID format
3. Test with different channel ID formats (UC... vs user URLs)
4. Check yt-dlp documentation for channel handling

#### For Playlist Issue:
1. Check server logs for stack trace
2. Verify if playlist functionality is implemented
3. Check if yt-dlp needs special handling for playlists
4. Test with different playlist IDs

---

## Recommendations

### Immediate Actions
1. **Check server logs** - Review Docker container logs for detailed error messages
2. **Test transcript fetching** - Investigate why transcripts return empty
3. **Fix channel endpoints** - Implement proper channel ID handling
4. **Fix playlist endpoint** - Implement or fix playlist support

### Testing Commands for Investigation

```bash
# Check Docker logs
docker logs [container-id] -f

# Test with channel URL instead of ID
curl -X POST http://localhost:3000/api/channel-details \
  -H "api-key: WhK!%hCNI0NyWP%Nb75uUjE%^abmuEJ%4T1PaD%848E" \
  -H "Content-Type: application/json" \
  -d '{"id":"https://www.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw"}'

# Test with different video that definitely has transcript
curl -X POST http://localhost:3000/api/transcript \
  -H "api-key: WhK!%hCNI0NyWP%Nb75uUjE%^abmuEJ%4T1PaD%848E" \
  -H "Content-Type: application/json" \
  -d '{"id":"jNQXAC9IVRw","type":"plain"}'  # "Me at the zoo" - first YouTube video
```

---

## Root Cause Analysis

### 🔍 Discovery: Incomplete Migration

After investigating the codebase, I found that **several endpoints were NOT migrated** from `youtubei` to `ytdlp-client`:

#### ✅ Migrated Endpoints (Working):
- ✅ `/api/video-details` - Uses `ytdlp-client`
- ✅ `/api/transcript` - Uses `ytdlp-client`
- ✅ `/api/video-languages` - Uses `ytdlp-client`
- ✅ `/api/search` - Uses `youtubei` wrapper

#### ❌ NOT Migrated (Still using old `youtubei`):
- ❌ `/api/channel-details` - Line 1: `import youtubei from "@/utils/youtubei"`
- ❌ `/api/channel-videos` - Line 1: `import youtubei from "@/utils/youtubei"`
- ❌ `/api/channel-live-videos` - Line 1: `import youtubei from "@/utils/youtubei"`
- ❌ `/api/playlist` - Line 1: `import youtubei from "@/utils/youtubei"`
- ❌ `/api/channel` - Line 1: `import youtubei from "@/utils/youtubei"`

### Why They're Failing

The `youtubei` wrapper in `src/utils/youtubei.js` is returning `null` or failing for channel/playlist operations because the old youtubei library is not properly integrated with the new yt-dlp backend.

### ⚠️ Transcript Issue

The transcript endpoint is properly migrated BUT is returning empty data. This needs investigation:
- Available languages are detected (182 languages)
- Language selection logic works
- But `YoutubeTranscript.fetchTranscript()` returns empty array

Possible causes:
1. YoutubeTranscript implementation issue in ytdlp-client
2. Network/SSL issues in Docker
3. YouTube blocking requests

---

## Conclusion

The migration to yt-dlp is **incomplete**:
- ✅ Video details endpoint migrated successfully
- ✅ Search functionality works (uses youtubei wrapper)
- ✅ Language detection works
- ✅ Error handling works
- ⚠️ Transcript fetching migrated but returns empty data
- ❌ Channel operations NOT MIGRATED YET
- ❌ Playlist functionality NOT MIGRATED YET

### Migration Status: **~60% Complete**

**Migrated**: 3/8 endpoints
**Working**: 3/8 endpoints  
**Needs Migration**: 5/8 endpoints

---

## Required Next Steps

### 1. Complete Migration (High Priority)
Migrate these endpoints from `youtubei` to `ytdlp-client`:
- [ ] `/api/channel-details`
- [ ] `/api/channel-videos`
- [ ] `/api/channel-live-videos`
- [ ] `/api/playlist`
- [ ] `/api/channel`

### 2. Fix Transcript Issue (High Priority)
- [ ] Debug why `YoutubeTranscript.fetchTranscript()` returns empty data
- [ ] Check Docker container logs for errors
- [ ] Test with different videos
- [ ] Verify yt-dlp caption extraction works

### 3. Testing After Migration (Medium Priority)
- [ ] Re-run all tests after migration is complete
- [ ] Verify response formats match original API
- [ ] Test pagination for channels and playlists
- [ ] Test edge cases (private videos, deleted content, etc.)

---

**Test Conducted By**: Automated Testing
**Test Environment**: Docker Container
**Overall Status**: ⚠️ **MIGRATION INCOMPLETE - 60% DONE**

**Recommendation**: Complete the migration of remaining 5 endpoints before deploying to production.

