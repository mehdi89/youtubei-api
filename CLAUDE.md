# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

YouTubei API is a Next.js-based REST API that wraps the YouTubei library to provide YouTube data access including video details, transcripts, channel information, and search functionality.

## Development Commands

### Core Commands
- `npm run dev` - Start development server on port 3000
- `npm run build` - Build production bundle
- `npm start` - Start production server
- `npm test` - Run test suite
- `npm test:watch` - Run tests in watch mode
- `npm test:coverage` - Generate test coverage report

### Docker Commands
- `docker compose up -d prod` - Run production container
- `docker compose build prod` - Build production image
- `docker compose ps` - Check container health
- `docker compose logs prod` - View production logs

## Architecture

### Tech Stack
- **Framework**: Next.js 15 with React 19
- **API Routes**: Next.js API routes pattern (pages/api/)
- **YouTube Client**: youtubei library for YouTube data access
- **HTTP Client**: Axios with browser-like headers
- **Testing**: Jest with React Testing Library
- **Deployment**: Docker containers

### Project Structure
```
src/
├── pages/
│   └── api/              # API endpoints
│       ├── video-details.js
│       ├── transcript.js
│       ├── search.js
│       ├── channel-*.js
│       └── __tests__/    # API tests
├── utils/
│   ├── youtubei.js      # Configured YouTube client
│   ├── logger.js        # Logging utility with visual indicators
│   └── youtube-transcript/ # Transcript fetching submodule
```

### Key Design Patterns

1. **API Authentication**: All endpoints require `api-key` header matching `YOUTUBE_API_KEY` environment variable

2. **Consistent Error Handling**: Standard HTTP status codes with JSON error messages:
   - 401: Invalid API key
   - 404: Resource not found
   - 405: Method not allowed
   - 500: Internal server error

3. **Logging System**: Visual indicators for operations:
   - ✅ SUCCESS
   - ❌ ERROR
   - ⚠️ WARN
   - ℹ️ INFO
   - 🔄 FETCH

4. **Request Pattern**: All endpoints use POST method with JSON body

5. **Response Format**: Standardized JSON responses with consistent field names

### API Endpoints

All endpoints require POST method and `api-key` header:

- `/api/video-details` - Video metadata with optional transcript
- `/api/transcript` - Video transcript with timestamped/plain options
- `/api/video-languages` - Available transcript languages
- `/api/search` - Search videos/channels/playlists
- `/api/channel-details` - Channel information
- `/api/channel-videos` - Channel video list with pagination
- `/api/channel-live-videos` - Channel live streams
- `/api/playlist` - Playlist videos with pagination

### Testing Strategy

- Unit tests for API endpoints using Jest
- Mock HTTP requests with node-mocks-http
- Test files in `__tests__` directories adjacent to source files
- Run single test: `npm test -- path/to/test.js`

### Environment Configuration

Required environment variable:
- `YOUTUBE_API_KEY` - API key for authentication

Create `.env` file in root with above variable for local development.

### Important Implementation Notes

1. **YouTube Client Configuration**: The youtubei client (src/utils/youtubei.js) is configured with browser-like headers and US/English locale settings

2. **Transcript Handling**: 
   - Uses custom youtube-transcript submodule in utils/
   - Supports multiple languages and formats (timestamped/plain)
   - Includes HTML entity decoding for clean text output

3. **Pagination**: Most list endpoints support page parameter for pagination

4. **Live Stream Detection**: Video responses include `isLive` field

5. **Error Recovery**: API gracefully handles YouTube service issues with appropriate error messages and logging

### yt-dlp Alternative Implementation

A Python-based drop-in replacement using yt-dlp is available at `app/python/ytdlp/` that:
- **Fixes youtubei issue #122**: Shorts and playlists now work correctly
- **Field name compatibility**: Accepts both original API field names and app field names
  - Example: `channelId` or `id`, `q` or `query`, `videoId` or `id`
- **Same authentication**: Uses the same `api-key` header and environment variable
- **Port configuration**: Runs on port 3001 by default (configurable via PORT env var)
- **Docker ready**: Includes Dockerfile for containerized deployment
- **100% API compatible**: Drop-in replacement requiring no backend changes