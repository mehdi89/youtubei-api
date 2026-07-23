# Phase 2 v2: Single Gateway + Proxy Pool Architecture

> Supersedes `GATEWAY_PLAN.md`. Simplifies from "gateway routing to 3 workers" to
> "1 server does everything, others are just proxies for IP diversity".

## Problem (same as before)

Laravel manages 3 yt-api servers: picks one randomly, retries on failure. Each server
caches independently in-memory, so the same video gets fetched from YouTube up to 3 times.
No shared cache, no centralized monitoring.

## What Changed From v1 Plan

The v1 plan kept all 3 servers as full yt-api workers with a gateway routing between them.
After deploying the proxy pool (Phase 1), we realized:

- The heavy work is **network I/O** (YouTube fetches), not CPU
- Servers 2 & 3 running full Next.js apps is overkill when they're mainly useful as **different IP addresses**
- A simpler architecture: one server does all the logic, others just proxy HTTP requests

**Removed from v1:**
- ~~`gateway.js`~~ - No worker forwarding/routing needed
- ~~`/api/gw/[...path].js`~~ - No catch-all gateway route
- ~~`GATEWAY_WORKERS` env var~~ - No workers to manage

**Kept from v1:**
- Redis L2 cache (the biggest win)
- `/api/status` monitoring endpoint
- `docker-compose.gateway.yml` for Redis

## Architecture

### Current (3 yt-api servers + 3 Python proxies)

```
                        ┌─────────────────────────────┐
                        │          Laravel             │
                        │   picks random, retries      │
                        └──────┬──────┬──────┬─────────┘
                               │      │      │
                 ┌─────────────┘      │      └─────────────┐
                 ▼                    ▼                     ▼
    ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐
    │ Server 1 (141)     │ │ Server 2 (53)      │ │ Server 3 (197)     │
    │ Next.js + Cache    │ │ Next.js + Cache    │ │ Next.js + Cache    │
    │ innertube + proxy  │ │ innertube + proxy  │ │ innertube + proxy  │
    └────────┬───────────┘ └────────┬───────────┘ └────────┬───────────┘
             │                      │                      │
             └──────────┬───────────┴───────────┬──────────┘
                        ▼                       ▼
              ┌──────────────────┐   ┌───────────────────┐
              │  Python Proxies  │   │     YouTube       │
              │  .94 .234 .20   │   │  (googlevideo)    │
              └──────────────────┘   └───────────────────┘

  Problems:
  - 3x duplicate YouTube fetches (no shared cache)
  - 3x deployment effort
  - Laravel manages server list + retry logic
  - Each server: ~500MB RAM for Next.js
```

### New (1 Gateway + proxy pool)

```
                        ┌─────────────────────────────┐
                        │          Laravel             │
                        │   single URL, no retry       │
                        └──────────────┬───────────────┘
                                       │
                                       ▼
                        ┌──────────────────────────────┐
                        │   Server 1: GATEWAY (141)    │
                        │                              │
                        │  ┌────────┐  ┌────────────┐  │
                        │  │  L1    │  │    Redis    │  │
                        │  │ Memory │◀▶│  L2 Cache   │  │
                        │  └────────┘  └────────────┘  │
                        │                              │
                        │  ┌──────────────────────┐    │
                        │  │  Next.js API          │    │
                        │  │  innertube.js         │    │
                        │  │  All endpoints        │    │
                        │  └───────────┬──────────┘    │
                        └──────────────┼───────────────┘
                                       │
                          YouTube fetch │ (direct or via proxy)
                                       ▼
               ┌───────────────────────────────────────────┐
               │              PROXY POOL                   │
               │                                           │
               │  ┌──────────┐ ┌──────────┐ ┌──────────┐  │
               │  │Server 2  │ │Server 3  │ │Python    │  │
               │  │  (53)    │ │  (197)   │ │Proxy .94 │  │
               │  │  proxy   │ │  proxy   │ │          │  │
               │  └──────────┘ └──────────┘ └──────────┘  │
               │  ┌──────────┐ ┌──────────┐ ┌──────────┐  │
               │  │Python    │ │Python    │ │ Evomi    │  │
               │  │Proxy .234│ │Proxy .20 │ │(optional)│  │
               │  └──────────┘ └──────────┘ └──────────┘  │
               └───────────────────────────────────────────┘
                                       │
                                       ▼
                              ┌──────────────┐
                              │   YouTube    │
                              │ googlevideo  │
                              └──────────────┘

  Wins:
  - Zero duplicate YouTube fetches (Redis shared cache)
  - 1 deployment target
  - Laravel uses 1 URL, no server list
  - Servers 2 & 3: ~50MB RAM each (proxy only)
  - Easy to add/remove proxies (Evomi, new IPs)
```

## Request Flow

```
 Laravel POST /api/video-details {id: "abc123"}
     │
     ▼
 ┌─ Gateway (Server 1) ──────────────────────────────────────┐
 │                                                           │
 │  1. Auth check (api-key header)                           │
 │     │                                                     │
 │  2. Check L1 in-memory cache ──hit──▶ return (< 1ms)     │
 │     │ miss                                                │
 │  3. Check L2 Redis cache ──hit──▶ warm L1, return (~2ms)  │
 │     │ miss                                                │
 │  4. innertube.getInfo(videoId)                            │
 │     │                                                     │
 │  5. Fetch captions from YouTube                           │
 │     │ success ──▶ skip to step 7                          │
 │     │ blocked/rate-limited                                │
 │  6. Proxy pool retry (round-robin through healthy proxies)│
 │     │                                                     │
 │  7. Cache in L1 + L2 Redis                                │
 │     │                                                     │
 │  8. Return response to Laravel                            │
 └───────────────────────────────────────────────────────────┘
```

## Cache Strategy

```
 Request arrives
     │
     ▼
 L1 In-Memory ──hit──▶ return instantly (< 1ms)
     │ miss
     ▼
 L2 Redis ──hit──▶ warm L1 + return (~2ms)
     │ miss
     ▼
 Fetch from YouTube (~200-2000ms)
     │
     ▼
 Write to L1 + L2 simultaneously
     │
     ▼
 Return response

 L1 = per-process, volatile (lost on restart)
 L2 = Redis, shared, persistent (survives restarts)
```

### TTLs (unchanged)

| Endpoint | TTL | Why |
|----------|-----|-----|
| video-details | 1 hour | Metadata changes slowly |
| transcript | 24 hours | Transcripts almost never change |
| search | 5 minutes | Results change frequently |
| channel-details | 1 hour | Channel info changes slowly |
| channel-videos | 15 minutes | New uploads |
| channel-live-videos | 2 minutes | Live status changes fast |
| playlist | 15 minutes | Playlist edits |

## Proxy Pool Configuration

### Gateway (Server 1) sees these proxies:

| # | Proxy | Type | IP |
|---|-------|------|----|
| 1 | 103.204.80.53 | Server 2 (proxy-only) | Direct IP |
| 2 | 121.200.63.197 | Server 3 (proxy-only) | Direct IP |
| 3 | 121.200.63.94:8081 | Python proxy | Direct IP |
| 4 | 121.200.63.234 | Python proxy (nginx) | Direct IP |
| 5 | 121.200.63.20 | Python proxy (nginx) | Direct IP |
| 6 | Evomi (optional) | Residential proxy | Rotating |

All proxies use the same `/fetch` endpoint interface.
Server 2 & 3 switch from full Next.js apps to lightweight Python proxy servers.

### Proxy endpoint contract (already exists):

```
POST /fetch
Body: { url, headers, secret }
Response: { body, status, contentType }
```

## Implementation

### New Files

#### 1. `src/utils/redis-cache.js` (~50 lines)

Async cache wrapper. Checks L1 (in-memory) first, then L2 (Redis).
All existing endpoints change `cache.get(key)` → `await cacheGet(key)`.

```js
// Pseudo-code
import Redis from 'ioredis';
import cache from './cache.js';

export async function cacheGet(key) {
  const l1 = cache.get(key);         // sync, fast
  if (l1) return l1;

  if (redis) {
    const val = await redis.get(key); // async, ~2ms
    if (val) {
      const parsed = JSON.parse(val);
      cache.set(key, parsed, ...);    // warm L1
      return parsed;
    }
  }
  return null;
}

export async function cacheSet(key, value, ttl) {
  cache.set(key, value, ttl);        // always L1
  if (redis) {
    await redis.set(key, JSON.stringify(value), 'EX', ttl);
  }
}
```

Key decisions:
- If `REDIS_URL` is empty, behaves exactly like today (L1 only)
- Read: L1 first (free), then L2. Write: both simultaneously
- `ioredis` with lazy connect, 1 retry, exponential backoff
- Graceful fallback: Redis down = L1-only mode (no errors)

#### 2. `src/pages/api/status.js` (~40 lines)

Health monitoring endpoint. No auth required (read-only).

```json
GET /api/status
{
  "uptime": 3600,
  "cache": {
    "l1": { "size": 150, "hitRate": "78%" },
    "redis": { "connected": true }
  },
  "proxy": {
    "pool": [
      { "url": "...", "healthy": true, "failures": 0 }
    ],
    "healthyCount": 5,
    "totalCount": 5
  }
}
```

#### 3. `docker-compose.gateway.yml` (~15 lines)

Redis service overlay for Server 1 only.

```yaml
services:
  redis:
    image: redis:7-alpine
    container_name: youtubei-redis
    restart: always
    ports:
      - "127.0.0.1:6379:6379"
    volumes:
      - redis-data:/data
    deploy:
      resources:
        limits:
          memory: 256M
  prod:
    depends_on:
      - redis
volumes:
  redis-data:
```

### Modified Files

#### 4. All API endpoints (minimal change)

Each endpoint changes 2 lines:

```diff
- import cache, { TTL } from '@/utils/cache';
+ import { TTL } from '@/utils/cache';
+ import { cacheGet, cacheSet } from '@/utils/redis-cache';

  // In handler:
- const cached = cache.get(cacheKey);
+ const cached = await cacheGet(cacheKey);

- cache.set(cacheKey, result, TTL.VIDEO_DETAILS);
+ await cacheSet(cacheKey, result, TTL.VIDEO_DETAILS);
```

Affected files (7 endpoints):
- `src/pages/api/video-details.js`
- `src/pages/api/transcript.js`
- `src/pages/api/search.js`
- `src/pages/api/channel-details.js`
- `src/pages/api/channel-videos.js`
- `src/pages/api/channel-live-videos.js`
- `src/pages/api/playlist.js`

#### 5. `src/utils/proxy.js` (export health data)

Add one function to expose health info for `/api/status`:

```js
export function getProxyHealth() {
  return pool.map(url => ({
    url,
    healthy: isHealthy(url),
    ...(health.get(url) || { failures: 0 })
  }));
}
```

#### 6. `package.json`

```diff
  "dependencies": {
+   "ioredis": "^5.4.0",
    "next": "^15.3.3",
```

### NOT changed

- `src/utils/cache.js` - Stays as-is (L1 in-memory, same API)
- `src/utils/innertube.js` - No changes
- `src/utils/logger.js` - No changes
- `src/pages/api/proxy-fetch.js` - Stays (still useful for testing)

## Env Changes

### Server 1 (Gateway) - `.env`

```env
# Add
REDIS_URL=redis://redis:6379
```

That's it. `PROXY_SERVERS` already configured from Phase 1.

### Server 1 - Docker startup changes

```bash
# Before
docker compose up -d

# After
docker compose -f docker-compose.yml -f docker-compose.gateway.yml up -d
```

### Servers 2 & 3 - Convert to proxy-only (Phase C)

Stop the Next.js containers, deploy Python proxy server instead.
The Python proxy server (`proxy/proxy-server.py`) already exists in the repo.

```bash
# On Server 2 & 3:
cd /var/www/html/youtubei-api
docker compose down

# Deploy Python proxy (same as 121.200.63.94 setup)
# ... (systemd service + nginx reverse proxy)
```

### Laravel

```env
# Before (3 servers)
YOUTUBE_API_BASEURL=https://yt-api.moneybag.com.bd,https://yt-api-1.moneybag.com.bd,https://yt-api-2.moneybag.com.bd

# After (1 gateway)
YOUTUBE_API_BASEURL=https://yt-api.moneybag.com.bd
```

No code change needed in Laravel if it already handles a single URL.
The `getRandomBaseUrl()` with 1 URL just returns that URL.

## Deployment Plan

### Phase A: Redis + cache upgrade on Server 1 (no behavior change)

1. `npm install ioredis`
2. Create `src/utils/redis-cache.js`
3. Create `src/pages/api/status.js`
4. Update 7 endpoint files (2-line change each)
5. Add `getProxyHealth()` to `proxy.js`
6. Create `docker-compose.gateway.yml`
7. Push to feature branch, build succeeds
8. Deploy to Server 1 with Redis:
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.gateway.yml up -d
   ```
9. Deploy to Servers 2 & 3 without Redis (no REDIS_URL = L1-only, same as today)
10. Verify: `/api/status` returns health info, existing endpoints work
11. Verify: Redis cache hits on repeated requests to Server 1

**Rollback:** Remove REDIS_URL from .env, restart. Falls back to L1-only.

### Phase B: Laravel cutover to single gateway

1. Update Laravel `.env`:
   ```
   YOUTUBE_API_BASEURL=https://yt-api.moneybag.com.bd
   ```
2. Deploy Laravel
3. Monitor: all traffic now flows through Server 1
4. Watch `/api/status` for cache hit rates and proxy health

**Rollback:** Revert Laravel `.env` to 3-server list. Instant.

### Phase C: Convert Servers 2 & 3 to proxy-only

1. On Server 2:
   ```bash
   docker compose down
   # Deploy Python proxy server (systemd + nginx)
   ```
2. Update Server 1 `PROXY_SERVERS` to use Server 2's new proxy endpoint
3. Repeat for Server 3
4. Verify proxy pool health via `/api/status`

**Rollback:** Re-deploy Next.js on Server 2/3, revert Laravel to 3-server list.

### Phase D: Optional enhancements

- Add Evomi residential proxy to pool for extra IP diversity
- Add Slack/webhook alerting from `/api/status`
- Tune Redis memory based on observed usage
- Consider warm standby gateway on Server 2

## Risk Mitigation

### Single Point of Failure

| Risk | Mitigation |
|------|------------|
| Server 1 goes down | Laravel gets errors. Cached summaries in DB still serve users. Manual recovery: start Next.js on Server 2 + revert Laravel env |
| Redis goes down | Graceful fallback to L1-only (no errors, just more YouTube fetches) |
| All proxies down | Gateway fetches directly from its own IP. May get rate-limited but still works |
| YouTube blocks all IPs | Same as today - no mitigation possible without new IPs |

### Warm Standby Option (if needed later)

Keep the Docker image on Server 2. If Server 1 dies:
1. `docker compose up -d` on Server 2
2. Update DNS or Laravel env to point to Server 2
3. Recovery time: ~2 minutes

## Resource Impact

### Server 1 (Gateway)
- **Before:** Next.js (~500MB) + proxy pool
- **After:** Next.js (~500MB) + Redis (~256MB max) + proxy pool
- **Net:** +256MB RAM, same CPU

### Servers 2 & 3 (proxy-only)
- **Before:** Next.js (~500MB each)
- **After:** Python proxy (~50MB each)
- **Net:** -450MB RAM each, freed CPU

### Total fleet
- **Before:** 3x Next.js = ~1.5GB
- **After:** 1x Next.js + 1x Redis + 2x Python = ~850MB
- **Savings:** ~650MB RAM, 2 fewer Node.js processes

## File Summary

| File | Action | Lines | Purpose |
|------|--------|-------|---------|
| `src/utils/redis-cache.js` | Create | ~50 | L1+L2 cache wrapper |
| `src/pages/api/status.js` | Create | ~40 | Health monitoring |
| `docker-compose.gateway.yml` | Create | ~15 | Redis for Server 1 |
| `src/pages/api/video-details.js` | Modify | 3 lines | Use redis-cache |
| `src/pages/api/transcript.js` | Modify | 3 lines | Use redis-cache |
| `src/pages/api/search.js` | Modify | 3 lines | Use redis-cache |
| `src/pages/api/channel-details.js` | Modify | 3 lines | Use redis-cache |
| `src/pages/api/channel-videos.js` | Modify | 3 lines | Use redis-cache |
| `src/pages/api/channel-live-videos.js` | Modify | 3 lines | Use redis-cache |
| `src/pages/api/playlist.js` | Modify | 3 lines | Use redis-cache |
| `src/utils/proxy.js` | Modify | ~8 lines | Export health data |
| `package.json` | Modify | 1 line | Add ioredis |

## Success Metrics

- Redis cache hit rate > 50% within first day
- YouTube API calls reduced by ~60% (no more 3x duplication)
- `/api/status` showing all proxies healthy
- Redis response time < 5ms (localhost)
- Zero downtime during migration (phased rollout)
- Server 2 & 3 RAM usage drops from ~500MB to ~50MB each
