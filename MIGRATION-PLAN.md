# Phase 2: Full Migration to youtubei.js

## Overview

This document outlines the plan to migrate all API endpoints from the legacy `youtubei` library to the actively maintained `youtubei.js` library.

## ✅ MIGRATION COMPLETE

All endpoints have been successfully migrated to `youtubei.js`.

| File | Library | Status |
|------|---------|--------|
| `video-details.js` | `youtubei.js` | ✅ Migrated |
| `transcript.js` | `youtubei.js` | ✅ Migrated |
| `search.js` | `youtubei.js` | ✅ Migrated |
| `channel-details.js` | `youtubei.js` | ✅ Migrated |
| `channel-videos.js` | `youtubei.js` | ✅ Migrated |
| `channel-live-videos.js` | `youtubei.js` | ✅ Migrated |
| `playlist.js` | `youtubei.js` | ✅ Migrated |

**See [NEW-FEATURES.md](./NEW-FEATURES.md) for documentation on all new API features.**

## Why Migrate?

1. **Maintenance**: `youtubei` (old) is less actively maintained
2. **Reliability**: `youtubei.js` handles YouTube API changes better
3. **Consistency**: Single library reduces complexity and bundle size
4. **Features**: `youtubei.js` has better TypeScript support and more features

## Migration Tasks

### Task 1: Search API (`search.js`)

**Current Implementation:**
```javascript
import youtubei from "@/utils/youtubei";
const youtube = youtubei;
let response = await youtube.search(query, { type });
```

**New Implementation:**
```javascript
import { getInnertube } from '@/utils/innertube';
const yt = await getInnertube();
const search = await yt.search(query, { type: 'video' }); // or 'channel', 'playlist'
```

**API Mapping:**
- `youtube.search(query, { type: 'video' })` → `yt.search(query, { type: 'video' })`
- Response structure may differ - need to map fields

**Estimated Effort:** Medium

---

### Task 2: Channel Details (`channel-details.js`)

**Current Implementation:**
```javascript
const channel = await youtube.findOne(id, { type: "channel" });
```

**New Implementation:**
```javascript
const yt = await getInnertube();
const channel = await yt.getChannel(id);
```

**Field Mapping:**
| Old Field | New Field |
|-----------|-----------|
| `channel.name` | `channel.metadata.title` |
| `channel.description` | `channel.metadata.description` |
| `channel.subscriberCount` | `channel.metadata.subscriber_count` |
| `channel.thumbnails` | `channel.metadata.avatar` |
| `channel.banner` | `channel.metadata.banner` |

**Estimated Effort:** Medium

---

### Task 3: Channel Videos (`channel-videos.js`)

**Current Implementation:**
```javascript
let channel = await youtube.findOne(id, { type: "channel" });
let newVideos = await channel.videos.next();
```

**New Implementation:**
```javascript
const yt = await getInnertube();
const channel = await yt.getChannel(id);
const videos = await channel.getVideos();
// Pagination: const moreVideos = await videos.getContinuation();
```

**Estimated Effort:** Medium-High (pagination logic differs)

---

### Task 4: Channel Live Videos (`channel-live-videos.js`)

**New Implementation:**
```javascript
const yt = await getInnertube();
const channel = await yt.getChannel(id);
const liveStreams = await channel.getLiveStreams();
```

**Estimated Effort:** Low

---

### Task 5: Playlist (`playlist.js`)

**Current Implementation:**
```javascript
const playlist = await youtube.findOne(id, { type: "playlist" });
let newVideos = await playlist.videos.next();
```

**New Implementation:**
```javascript
const yt = await getInnertube();
const playlist = await yt.getPlaylist(id);
// Videos are in playlist.videos
// Pagination: const more = await playlist.getContinuation();
```

**Estimated Effort:** Medium

---

### Task 6: Cleanup

After all migrations are complete:

1. **Delete old utility file:**
   ```bash
   rm src/utils/youtubei.js
   ```

2. **Remove old dependency:**
   ```bash
   npm uninstall youtubei
   ```

3. **Update package.json** - remove `youtubei` from dependencies

4. **Run full test suite:**
   ```bash
   npm run test:all
   ```

---

## Testing Strategy

### Before Each Migration

1. Run integration tests on current implementation:
   ```bash
   npm run test:integration
   ```

2. Document current API response structure

### After Each Migration

1. Run unit tests:
   ```bash
   npm test
   ```

2. Run integration tests:
   ```bash
   npm run test:integration
   ```

3. Manual smoke test with curl:
   ```bash
   curl -X POST "http://localhost:3000/api/search" \
     -H "Content-Type: application/json" \
     -H "api-key: YOUR_KEY" \
     -d '{"type": "video", "query": "test"}'
   ```

---

## Rollback Plan

If issues arise after migration:

1. Revert the specific file from git:
   ```bash
   git checkout HEAD~1 -- src/pages/api/[file].js
   ```

2. Keep both libraries installed until fully validated

3. Feature flag option (if needed):
   ```javascript
   const USE_NEW_LIBRARY = process.env.USE_YOUTUBEI_JS === 'true';
   ```

---

## Migration Order (Recommended)

1. **search.js** - Most commonly used, good validation point
2. **channel-details.js** - Simple, low risk
3. **channel-videos.js** - More complex, pagination
4. **channel-live-videos.js** - Low usage, easy
5. **playlist.js** - Medium complexity
6. **video-languages.js** - Review and migrate/remove
7. **Cleanup** - Remove old library

---

## Success Criteria

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] No `youtubei` (old library) imports remain
- [ ] `youtubei` removed from package.json
- [ ] Bundle size reduced
- [ ] Production deployment successful
- [ ] No increase in error rates for 48 hours

---

## References

- [youtubei.js Documentation](https://github.com/LuanRT/YouTube.js)
- [youtubei.js API Reference](https://ytjs.dev/)
- [Migration Examples](https://github.com/LuanRT/YouTube.js/wiki/Migration-Guide)
