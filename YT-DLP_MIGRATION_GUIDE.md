# yt-dlp Migration Guide for YouTubei API

## Overview

This guide provides detailed instructions for reimplementing the YouTubei API using yt-dlp as the backend. yt-dlp is a more robust and actively maintained alternative that can handle YouTube's frequent changes better than the current youtubei library.

## Installation

```bash
# Python dependencies
pip install yt-dlp fastapi uvicorn python-dotenv

# Or using requirements.txt
cat > requirements.txt << EOF
yt-dlp>=2024.1.0
fastapi>=0.104.0
uvicorn>=0.24.0
python-dotenv>=1.0.0
python-multipart>=0.0.6
EOF

pip install -r requirements.txt
```

## Python Implementation Examples

### 1. Base Configuration

```python
# config.py
import yt_dlp
from typing import Dict, Any
import os
from dotenv import load_dotenv

load_dotenv()

class YTDLPConfig:
    """Configuration for yt-dlp operations"""
    
    @staticmethod
    def get_base_opts() -> Dict[str, Any]:
        return {
            'quiet': True,
            'no_warnings': True,
            'skip_download': True,
            'ignoreerrors': False,
            'no_check_certificate': True,
            'geo_bypass': True,
            'nocheckcertificate': True,
            'preferredcodec': 'mp4',
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'referer': 'https://www.youtube.com/',
        }
    
    @staticmethod
    def get_video_opts() -> Dict[str, Any]:
        opts = YTDLPConfig.get_base_opts()
        opts.update({
            'extract_flat': False,
            'format': 'best',
        })
        return opts
    
    @staticmethod
    def get_channel_opts() -> Dict[str, Any]:
        opts = YTDLPConfig.get_base_opts()
        opts.update({
            'extract_flat': 'in_playlist',
            'playlist_items': '1-30',  # Limit to first 30 items
        })
        return opts
    
    @staticmethod
    def get_transcript_opts() -> Dict[str, Any]:
        opts = YTDLPConfig.get_base_opts()
        opts.update({
            'writesubtitles': True,
            'writeautomaticsub': True,
            'subtitleslangs': ['en', 'en-US'],
            'skip_download': True,
        })
        return opts
```

### 2. Video Details Implementation

```python
# video_service.py
import yt_dlp
from typing import Dict, Any, Optional
import re

class VideoService:
    def __init__(self):
        self.ydl_opts = YTDLPConfig.get_video_opts()
    
    def get_video_details(self, video_id: str, include_transcript: bool = False) -> Dict[str, Any]:
        """Fetch video details matching the original API response format"""
        
        url = f"https://www.youtube.com/watch?v={video_id}"
        
        with yt_dlp.YoutubeDL(self.ydl_opts) as ydl:
            try:
                info = ydl.extract_info(url, download=False)
                
                # Format response to match original API
                response = {
                    "id": info.get('id'),
                    "title": info.get('title'),
                    "description": info.get('description'),
                    "duration": self._format_duration(info.get('duration')),
                    "uploadDate": info.get('upload_date'),
                    "viewCount": info.get('view_count'),
                    "likeCount": info.get('like_count'),
                    "isLive": info.get('is_live', False),
                    "channel": {
                        "id": info.get('channel_id'),
                        "name": info.get('channel'),
                        "subscriberCount": self._format_subscriber_count(info.get('channel_follower_count'))
                    },
                    "thumbnail": self._get_best_thumbnail(info.get('thumbnails', [])),
                    "availableQualities": self._get_available_qualities(info.get('formats', [])),
                    "category": info.get('categories', [''])[0] if info.get('categories') else None,
                    "tags": info.get('tags', [])
                }
                
                if include_transcript:
                    response['transcript'] = self._get_transcript(video_id)
                
                return response
                
            except Exception as e:
                raise Exception(f"Failed to fetch video details: {str(e)}")
    
    def _format_duration(self, seconds: Optional[int]) -> str:
        """Convert seconds to MM:SS or HH:MM:SS format"""
        if not seconds:
            return "0:00"
        
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        secs = seconds % 60
        
        if hours > 0:
            return f"{hours}:{minutes:02d}:{secs:02d}"
        return f"{minutes}:{secs:02d}"
    
    def _format_subscriber_count(self, count: Optional[int]) -> str:
        """Format subscriber count like '3.5M subscribers'"""
        if not count:
            return "0 subscribers"
        
        if count >= 1_000_000:
            return f"{count/1_000_000:.1f}M subscribers"
        elif count >= 1_000:
            return f"{count/1_000:.1f}K subscribers"
        return f"{count} subscribers"
    
    def _get_best_thumbnail(self, thumbnails: list) -> str:
        """Get the highest quality thumbnail URL"""
        if not thumbnails:
            return ""
        
        # Sort by resolution (width * height)
        sorted_thumbs = sorted(
            thumbnails,
            key=lambda x: x.get('width', 0) * x.get('height', 0),
            reverse=True
        )
        return sorted_thumbs[0].get('url', '')
    
    def _get_available_qualities(self, formats: list) -> list:
        """Extract available video qualities"""
        qualities = set()
        for fmt in formats:
            height = fmt.get('height')
            if height:
                qualities.add(f"{height}p")
        return sorted(list(qualities), key=lambda x: int(x[:-1]), reverse=True)
    
    def _get_transcript(self, video_id: str) -> Optional[str]:
        """Fetch video transcript"""
        transcript_service = TranscriptService()
        try:
            return transcript_service.get_transcript(video_id, format='plain')
        except:
            return None
```

### 3. Transcript Implementation

```python
# transcript_service.py
import yt_dlp
import json
import re
from typing import Dict, Any, List, Optional

class TranscriptService:
    def __init__(self):
        self.ydl_opts = YTDLPConfig.get_transcript_opts()
    
    def get_transcript(self, video_id: str, lang: str = 'en', format: str = 'plain') -> Any:
        """Fetch video transcript in plain or timestamped format"""
        
        url = f"https://www.youtube.com/watch?v={video_id}"
        
        # Configure options for subtitle extraction
        opts = self.ydl_opts.copy()
        opts['subtitleslangs'] = [lang, f'{lang}-US', 'en', 'en-US']  # Fallback languages
        
        with yt_dlp.YoutubeDL(opts) as ydl:
            try:
                info = ydl.extract_info(url, download=False)
                
                # Try to get manual subtitles first, then automatic
                subtitles = info.get('subtitles', {})
                automatic_captions = info.get('automatic_captions', {})
                
                # Find best available language
                transcript_data = None
                for language in [lang, f'{lang}-US', 'en', 'en-US']:
                    if language in subtitles:
                        transcript_data = subtitles[language]
                        break
                    elif language in automatic_captions:
                        transcript_data = automatic_captions[language]
                        break
                
                if not transcript_data:
                    raise Exception(f"No transcript available for language: {lang}")
                
                # Find JSON format (most detailed)
                json_sub = next((s for s in transcript_data if s.get('ext') == 'json3'), None)
                
                if json_sub:
                    # Download and parse JSON subtitle
                    import urllib.request
                    with urllib.request.urlopen(json_sub['url']) as response:
                        json_data = json.loads(response.read())
                    
                    if format == 'timestamped':
                        return self._format_timestamped(json_data)
                    else:
                        return self._format_plain(json_data)
                else:
                    # Fallback to other formats
                    raise Exception("Could not fetch transcript in required format")
                    
            except Exception as e:
                raise Exception(f"Failed to fetch transcript: {str(e)}")
    
    def _format_plain(self, json_data: Dict) -> str:
        """Convert JSON subtitle data to plain text"""
        events = json_data.get('events', [])
        text_parts = []
        
        for event in events:
            if 'segs' in event:
                for seg in event['segs']:
                    text = seg.get('utf8', '')
                    if text and text.strip():
                        text_parts.append(text.strip())
        
        return ' '.join(text_parts)
    
    def _format_timestamped(self, json_data: Dict) -> List[Dict]:
        """Convert JSON subtitle data to timestamped format"""
        events = json_data.get('events', [])
        timestamped = []
        
        for event in events:
            if 'segs' in event and 'tStartMs' in event:
                text_parts = []
                for seg in event['segs']:
                    text = seg.get('utf8', '')
                    if text and text.strip():
                        text_parts.append(text.strip())
                
                if text_parts:
                    timestamped.append({
                        'text': ' '.join(text_parts),
                        'offset': event.get('tStartMs', 0),
                        'duration': event.get('dDurationMs', 0)
                    })
        
        return timestamped
    
    def get_available_languages(self, video_id: str) -> List[Dict[str, str]]:
        """Get all available transcript languages for a video"""
        
        url = f"https://www.youtube.com/watch?v={video_id}"
        
        with yt_dlp.YoutubeDL(self.ydl_opts) as ydl:
            try:
                info = ydl.extract_info(url, download=False)
                
                languages = []
                
                # Manual subtitles
                for lang_code in info.get('subtitles', {}).keys():
                    languages.append({
                        'language': self._get_language_name(lang_code),
                        'language_code': lang_code
                    })
                
                # Automatic captions
                for lang_code in info.get('automatic_captions', {}).keys():
                    if not any(l['language_code'] == lang_code for l in languages):
                        languages.append({
                            'language': f"{self._get_language_name(lang_code)} (auto)",
                            'language_code': lang_code
                        })
                
                return languages
                
            except Exception as e:
                raise Exception(f"Failed to fetch languages: {str(e)}")
    
    def _get_language_name(self, code: str) -> str:
        """Convert language code to readable name"""
        # Add comprehensive language mapping here
        language_map = {
            'en': 'English',
            'es': 'Spanish',
            'fr': 'French',
            'de': 'German',
            'ja': 'Japanese',
            'ko': 'Korean',
            'zh': 'Chinese',
            'pt': 'Portuguese',
            'ru': 'Russian',
            'it': 'Italian',
            # Add more as needed
        }
        return language_map.get(code.split('-')[0], code)
```

### 4. Channel Implementation

```python
# channel_service.py
import yt_dlp
from typing import Dict, Any, List, Optional

class ChannelService:
    def __init__(self):
        self.ydl_opts = YTDLPConfig.get_channel_opts()
    
    def get_channel_details(self, channel_id: str) -> Dict[str, Any]:
        """Fetch channel information"""
        
        # Handle different input formats
        if channel_id.startswith('@'):
            url = f"https://www.youtube.com/{channel_id}"
        elif channel_id.startswith('UC'):
            url = f"https://www.youtube.com/channel/{channel_id}"
        else:
            url = f"https://www.youtube.com/@{channel_id}"
        
        with yt_dlp.YoutubeDL(self.ydl_opts) as ydl:
            try:
                info = ydl.extract_info(url, download=False)
                
                return {
                    "id": info.get('channel_id'),
                    "name": info.get('channel'),
                    "handle": f"@{info.get('uploader_id')}" if info.get('uploader_id') else None,
                    "description": info.get('description'),
                    "subscriberCount": self._format_subscriber_count(info.get('channel_follower_count')),
                    "videoCount": str(info.get('playlist_count', 0)),
                    "thumbnails": {
                        "default": self._get_channel_avatar(info),
                        "banner": self._get_channel_banner(info)
                    }
                }
            except Exception as e:
                raise Exception(f"Failed to fetch channel details: {str(e)}")
    
    def get_channel_videos(self, channel_id: str, tab: str = 'videos', page: int = 1) -> List[Dict]:
        """Fetch videos from a specific channel tab"""
        
        # Map tabs to YouTube URLs
        tab_map = {
            'videos': '/videos',
            'shorts': '/shorts',
            'streams': '/streams',
            'playlists': '/playlists'
        }
        
        if tab not in tab_map:
            raise ValueError(f"Invalid tab. Must be one of: {', '.join(tab_map.keys())}")
        
        # Build URL
        if channel_id.startswith('@'):
            base_url = f"https://www.youtube.com/{channel_id}"
        elif channel_id.startswith('UC'):
            base_url = f"https://www.youtube.com/channel/{channel_id}"
        else:
            base_url = f"https://www.youtube.com/@{channel_id}"
        
        url = base_url + tab_map[tab]
        
        # Configure pagination
        items_per_page = 30
        start_index = (page - 1) * items_per_page + 1
        end_index = page * items_per_page
        
        opts = self.ydl_opts.copy()
        opts['playlist_items'] = f'{start_index}-{end_index}'
        
        with yt_dlp.YoutubeDL(opts) as ydl:
            try:
                info = ydl.extract_info(url, download=False)
                
                entries = info.get('entries', [])
                
                if tab == 'playlists':
                    return self._format_playlists(entries)
                else:
                    return self._format_videos(entries, is_live=(tab == 'streams'))
                    
            except Exception as e:
                # Check if it's the known shorts/playlists issue
                if tab in ['shorts', 'playlists'] and len(entries) == 0:
                    return {
                        "items": [],
                        "notice": f"{tab.capitalize()} fetching may not be fully supported. Try using yt-dlp directly."
                    }
                raise Exception(f"Failed to fetch channel {tab}: {str(e)}")
    
    def _format_videos(self, entries: List[Dict], is_live: bool = False) -> List[Dict]:
        """Format video entries to match API response"""
        videos = []
        for entry in entries:
            if entry:  # Some entries might be None
                videos.append({
                    "id": entry.get('id'),
                    "title": entry.get('title'),
                    "duration": self._format_duration(entry.get('duration')),
                    "description": entry.get('description', ''),
                    "isLive": entry.get('is_live', is_live),
                    "viewCount": str(entry.get('view_count', 0)),
                    "uploadDate": entry.get('upload_date'),
                    "thumbnail": f"https://img.youtube.com/vi/{entry.get('id')}/hqdefault.jpg",
                    "channelName": entry.get('channel'),
                    "channelID": entry.get('channel_id')
                })
        return videos
    
    def _format_playlists(self, entries: List[Dict]) -> List[Dict]:
        """Format playlist entries to match API response"""
        playlists = []
        for entry in entries:
            if entry:
                playlists.append({
                    "id": entry.get('id'),
                    "title": entry.get('title'),
                    "videoCount": str(entry.get('playlist_count', 0)),
                    "thumbnail": self._get_playlist_thumbnail(entry),
                    "channelName": entry.get('channel'),
                    "channelID": entry.get('channel_id')
                })
        return playlists
    
    def _get_playlist_thumbnail(self, entry: Dict) -> str:
        """Get playlist thumbnail"""
        # Try to get thumbnail from entry
        if entry.get('thumbnails'):
            return self._get_best_thumbnail(entry['thumbnails'])
        # Fallback to first video thumbnail
        if entry.get('entries') and len(entry['entries']) > 0:
            first_video = entry['entries'][0]
            if first_video and first_video.get('id'):
                return f"https://img.youtube.com/vi/{first_video['id']}/hqdefault.jpg"
        return ""
    
    def _format_duration(self, seconds: Optional[int]) -> str:
        """Convert seconds to duration string"""
        if not seconds:
            return ""
        
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        secs = seconds % 60
        
        if hours > 0:
            return f"{hours}:{minutes:02d}:{secs:02d}"
        return f"{minutes}:{secs:02d}"
    
    def _format_subscriber_count(self, count: Optional[int]) -> str:
        """Format subscriber count"""
        if not count:
            return "0 subscribers"
        
        if count >= 1_000_000:
            return f"{count/1_000_000:.1f}M subscribers"
        elif count >= 1_000:
            return f"{count/1_000:.1f}K subscribers"
        return f"{count} subscribers"
    
    def _get_channel_avatar(self, info: Dict) -> str:
        """Extract channel avatar URL"""
        thumbnails = info.get('thumbnails', [])
        if thumbnails:
            return thumbnails[-1].get('url', '')
        return ''
    
    def _get_channel_banner(self, info: Dict) -> str:
        """Extract channel banner URL"""
        # yt-dlp might not provide banner directly
        # Would need additional scraping for banner
        return ''
    
    def _get_best_thumbnail(self, thumbnails: list) -> str:
        """Get the highest quality thumbnail URL"""
        if not thumbnails:
            return ""
        
        sorted_thumbs = sorted(
            thumbnails,
            key=lambda x: x.get('width', 0) * x.get('height', 0),
            reverse=True
        )
        return sorted_thumbs[0].get('url', '')
```

### 5. Search Implementation

```python
# search_service.py
import yt_dlp
from typing import Dict, Any, List

class SearchService:
    def __init__(self):
        self.ydl_opts = YTDLPConfig.get_base_opts()
        self.ydl_opts['extract_flat'] = 'in_playlist'
    
    def search(self, query: str, search_type: str = 'video', limit: int = 20) -> Dict[str, List]:
        """Search YouTube for videos, channels, or playlists"""
        
        # Build search URL based on type
        if search_type == 'all':
            search_url = f"ytsearch{limit}:{query}"
        elif search_type == 'channel':
            # Search for channels specifically
            search_url = f"ytsearch{limit}:{query} channel"
        elif search_type == 'playlist':
            search_url = f"ytsearch{limit}:{query} playlist"
        else:  # video
            search_url = f"ytsearch{limit}:{query}"
        
        with yt_dlp.YoutubeDL(self.ydl_opts) as ydl:
            try:
                info = ydl.extract_info(search_url, download=False)
                
                entries = info.get('entries', [])
                results = []
                
                for entry in entries:
                    if not entry:
                        continue
                    
                    # Determine result type
                    if entry.get('_type') == 'channel':
                        result_type = 'channel'
                    elif entry.get('_type') == 'playlist':
                        result_type = 'playlist'
                    else:
                        result_type = 'video'
                    
                    # Format based on type
                    if result_type == 'channel':
                        results.append(self._format_channel_result(entry))
                    elif result_type == 'playlist':
                        results.append(self._format_playlist_result(entry))
                    else:
                        results.append(self._format_video_result(entry))
                
                # Filter by type if not 'all'
                if search_type != 'all':
                    results = [r for r in results if r.get('type') == search_type]
                
                return {"items": results[:limit]}
                
            except Exception as e:
                raise Exception(f"Search failed: {str(e)}")
    
    def _format_video_result(self, entry: Dict) -> Dict:
        """Format video search result"""
        return {
            "id": entry.get('id'),
            "title": entry.get('title'),
            "type": "video",
            "duration": self._format_duration(entry.get('duration')),
            "viewCount": self._format_view_count(entry.get('view_count')),
            "uploadDate": self._format_upload_date(entry.get('upload_date')),
            "thumbnail": f"https://img.youtube.com/vi/{entry.get('id')}/hqdefault.jpg",
            "channel": {
                "id": entry.get('channel_id'),
                "name": entry.get('channel')
            }
        }
    
    def _format_channel_result(self, entry: Dict) -> Dict:
        """Format channel search result"""
        return {
            "id": entry.get('channel_id', entry.get('id')),
            "title": entry.get('channel', entry.get('title')),
            "type": "channel",
            "subscriberCount": self._format_subscriber_count(entry.get('channel_follower_count')),
            "videoCount": entry.get('playlist_count'),
            "thumbnail": self._get_best_thumbnail(entry.get('thumbnails', []))
        }
    
    def _format_playlist_result(self, entry: Dict) -> Dict:
        """Format playlist search result"""
        return {
            "id": entry.get('id'),
            "title": entry.get('title'),
            "type": "playlist",
            "videoCount": entry.get('playlist_count'),
            "channel": {
                "id": entry.get('channel_id'),
                "name": entry.get('channel')
            },
            "thumbnail": self._get_best_thumbnail(entry.get('thumbnails', []))
        }
    
    def _format_duration(self, seconds: Optional[int]) -> str:
        """Format duration"""
        if not seconds:
            return ""
        
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        secs = seconds % 60
        
        if hours > 0:
            return f"{hours}:{minutes:02d}:{secs:02d}"
        return f"{minutes}:{secs:02d}"
    
    def _format_view_count(self, count: Optional[int]) -> str:
        """Format view count"""
        if not count:
            return "0"
        
        if count >= 1_000_000_000:
            return f"{count/1_000_000_000:.1f}B"
        elif count >= 1_000_000:
            return f"{count/1_000_000:.1f}M"
        elif count >= 1_000:
            return f"{count/1_000:.1f}K"
        return str(count)
    
    def _format_upload_date(self, date: Optional[str]) -> str:
        """Format upload date"""
        if not date:
            return ""
        
        # Convert YYYYMMDD to a more readable format
        # You might want to calculate relative time (e.g., "2 days ago")
        return date
    
    def _format_subscriber_count(self, count: Optional[int]) -> str:
        """Format subscriber count"""
        if not count:
            return "0"
        
        if count >= 1_000_000:
            return f"{count/1_000_000:.1f}M"
        elif count >= 1_000:
            return f"{count/1_000:.1f}K"
        return str(count)
    
    def _get_best_thumbnail(self, thumbnails: list) -> str:
        """Get best thumbnail"""
        if not thumbnails:
            return ""
        
        sorted_thumbs = sorted(
            thumbnails,
            key=lambda x: x.get('width', 0) * x.get('height', 0),
            reverse=True
        )
        return sorted_thumbs[0].get('url', '')
```

### 6. FastAPI Application

```python
# main.py
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Literal
import os
from dotenv import load_dotenv

# Import services
from video_service import VideoService
from transcript_service import TranscriptService
from channel_service import ChannelService
from search_service import SearchService

load_dotenv()

app = FastAPI(title="YouTube API (yt-dlp)", version="2.0.0")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Services
video_service = VideoService()
transcript_service = TranscriptService()
channel_service = ChannelService()
search_service = SearchService()

# API Key validation
API_KEY = os.getenv("YOUTUBE_API_KEY", "default_key")

def verify_api_key(api_key: str = Header(None)):
    if api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Please provide correct API key")
    return api_key

# Request Models
class VideoDetailsRequest(BaseModel):
    id: str
    includeTranscript: Optional[bool] = False

class TranscriptRequest(BaseModel):
    videoId: str
    lang: Optional[str] = "en"
    format: Optional[Literal["plain", "timestamped"]] = "plain"

class ChannelVideosRequest(BaseModel):
    id: str
    page: Optional[int] = 1
    tab: Optional[Literal["videos", "shorts", "streams", "playlists"]] = "videos"

class SearchRequest(BaseModel):
    query: str
    type: Optional[Literal["video", "channel", "playlist", "all"]] = "video"
    limit: Optional[int] = 20

# Endpoints
@app.post("/api/video-details")
async def get_video_details(request: VideoDetailsRequest, api_key: str = Header(None)):
    verify_api_key(api_key)
    try:
        return video_service.get_video_details(
            request.id, 
            request.includeTranscript
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/transcript")
async def get_transcript(request: TranscriptRequest, api_key: str = Header(None)):
    verify_api_key(api_key)
    try:
        transcript = transcript_service.get_transcript(
            request.videoId,
            request.lang,
            request.format
        )
        
        if request.format == "plain":
            return {"transcript": transcript}
        else:
            return {"transcript": transcript}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/video-languages")
async def get_video_languages(request: dict, api_key: str = Header(None)):
    verify_api_key(api_key)
    try:
        languages = transcript_service.get_available_languages(request["videoId"])
        return {"languages": languages}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/channel-details")
async def get_channel_details(request: dict, api_key: str = Header(None)):
    verify_api_key(api_key)
    try:
        return channel_service.get_channel_details(request["id"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/channel-videos")
async def get_channel_videos(request: ChannelVideosRequest, api_key: str = Header(None)):
    verify_api_key(api_key)
    try:
        return channel_service.get_channel_videos(
            request.id,
            request.tab,
            request.page
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/search")
async def search(request: SearchRequest, api_key: str = Header(None)):
    verify_api_key(api_key)
    try:
        return search_service.search(
            request.query,
            request.type,
            request.limit
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Run with: uvicorn main:app --reload --port 3000
```

## Shell Script Examples

For simpler implementations or testing, here are shell script examples:

```bash
#!/bin/bash
# yt-dlp-api.sh - Simple shell implementation

# Get video details
get_video_details() {
    local video_id=$1
    yt-dlp --dump-json "https://youtube.com/watch?v=${video_id}" | \
    jq '{
        id: .id,
        title: .title,
        description: .description,
        duration: .duration,
        uploadDate: .upload_date,
        viewCount: .view_count,
        likeCount: .like_count,
        channel: {
            id: .channel_id,
            name: .channel
        }
    }'
}

# Get transcript
get_transcript() {
    local video_id=$1
    local lang=${2:-en}
    
    # Download subtitle file
    yt-dlp --write-subs --sub-lang ${lang} --skip-download \
           -o "%(id)s.%(ext)s" "https://youtube.com/watch?v=${video_id}"
    
    # Parse subtitle file (assuming .vtt format)
    if [ -f "${video_id}.${lang}.vtt" ]; then
        # Remove timestamps and format
        sed '1,4d' "${video_id}.${lang}.vtt" | \
        sed '/^[0-9][0-9]:/d' | \
        sed '/^$/d' | \
        tr '\n' ' '
        
        # Clean up
        rm -f "${video_id}.${lang}.vtt"
    else
        echo "No transcript available"
    fi
}

# Search videos
search_videos() {
    local query=$1
    local limit=${2:-20}
    
    yt-dlp "ytsearch${limit}:${query}" --flat-playlist -J | \
    jq '.entries[] | {
        id: .id,
        title: .title,
        duration: .duration,
        channel: .channel
    }'
}

# Get channel videos
get_channel_videos() {
    local channel=$1
    local tab=${2:-videos}
    
    local url="https://youtube.com/@${channel}/${tab}"
    
    yt-dlp "${url}" --flat-playlist -J --playlist-items 1-30 | \
    jq '.entries[] | {
        id: .id,
        title: .title,
        duration: .duration,
        uploadDate: .upload_date
    }'
}

# Main CLI interface
case "$1" in
    video)
        get_video_details "$2"
        ;;
    transcript)
        get_transcript "$2" "$3"
        ;;
    search)
        search_videos "$2" "$3"
        ;;
    channel)
        get_channel_videos "$2" "$3"
        ;;
    *)
        echo "Usage: $0 {video|transcript|search|channel} [args...]"
        exit 1
        ;;
esac
```

## Docker Deployment

```dockerfile
# Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3000"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  youtube-api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - YOUTUBE_API_KEY=${YOUTUBE_API_KEY}
    volumes:
      - ./cache:/app/cache  # Optional: for caching
    restart: unless-stopped
```

## Performance Optimizations

### 1. Caching Implementation

```python
# cache_service.py
import json
import hashlib
import time
from typing import Any, Optional
import redis  # pip install redis

class CacheService:
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis_client = redis.from_url(redis_url)
        self.default_ttl = 3600  # 1 hour
    
    def get_cache_key(self, prefix: str, params: dict) -> str:
        """Generate cache key from parameters"""
        param_str = json.dumps(params, sort_keys=True)
        hash_val = hashlib.md5(param_str.encode()).hexdigest()
        return f"{prefix}:{hash_val}"
    
    def get(self, key: str) -> Optional[Any]:
        """Get cached value"""
        try:
            value = self.redis_client.get(key)
            if value:
                return json.loads(value)
        except:
            pass
        return None
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None):
        """Set cached value"""
        try:
            self.redis_client.setex(
                key,
                ttl or self.default_ttl,
                json.dumps(value)
            )
        except:
            pass
    
    def invalidate_pattern(self, pattern: str):
        """Invalidate all keys matching pattern"""
        for key in self.redis_client.scan_iter(match=pattern):
            self.redis_client.delete(key)
```

### 2. Rate Limiting

```python
# rate_limiter.py
from fastapi import HTTPException
import time
from collections import defaultdict
from threading import Lock

class RateLimiter:
    def __init__(self, requests_per_minute: int = 60):
        self.requests_per_minute = requests_per_minute
        self.requests = defaultdict(list)
        self.lock = Lock()
    
    def check_rate_limit(self, api_key: str):
        """Check if request is within rate limit"""
        with self.lock:
            now = time.time()
            minute_ago = now - 60
            
            # Clean old requests
            self.requests[api_key] = [
                req_time for req_time in self.requests[api_key]
                if req_time > minute_ago
            ]
            
            # Check limit
            if len(self.requests[api_key]) >= self.requests_per_minute:
                raise HTTPException(
                    status_code=429,
                    detail="Rate limit exceeded"
                )
            
            # Add current request
            self.requests[api_key].append(now)
```

## Testing

```python
# test_api.py
import pytest
import httpx
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_video_details():
    response = client.post(
        "/api/video-details",
        json={"id": "dQw4w9WgXcQ"},
        headers={"api-key": "test_key"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "title" in data
    assert "channel" in data

def test_search():
    response = client.post(
        "/api/search",
        json={"query": "python tutorial", "limit": 5},
        headers={"api-key": "test_key"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert len(data["items"]) <= 5

# Run with: pytest test_api.py
```

## Monitoring & Logging

```python
# logging_config.py
import logging
from datetime import datetime

def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(f'logs/api_{datetime.now().strftime("%Y%m%d")}.log'),
            logging.StreamHandler()
        ]
    )
    
    # Set yt-dlp logging
    yt_dlp_logger = logging.getLogger('yt-dlp')
    yt_dlp_logger.setLevel(logging.WARNING)
```

## Common Issues & Solutions

### 1. Age-Restricted Videos
```python
# Add cookies for authentication
ydl_opts['cookiefile'] = 'cookies.txt'  # Export cookies from browser
```

### 2. Rate Limiting by YouTube
```python
# Add delays between requests
import time
time.sleep(1)  # Add delay between requests
```

### 3. Geo-Blocked Content
```python
# Use proxy
ydl_opts['proxy'] = 'http://proxy.example.com:8080'
```

### 4. Handling YouTube Changes
```bash
# Keep yt-dlp updated
pip install --upgrade yt-dlp
```

## Advantages of yt-dlp over YouTubei

1. **Active Maintenance**: Frequent updates to handle YouTube changes
2. **Better Format Support**: Handles various video/audio formats
3. **Robust Error Handling**: Better error messages and recovery
4. **Shorts & Playlists**: Properly supports all content types
5. **Authentication**: Can use cookies for age-restricted content
6. **Proxy Support**: Built-in proxy and geo-bypass features
7. **Community**: Large community and extensive documentation

## Migration Checklist

- [ ] Install yt-dlp and dependencies
- [ ] Set up Python/FastAPI application
- [ ] Implement all service classes
- [ ] Configure authentication (API keys)
- [ ] Set up caching (Redis/Memory)
- [ ] Implement rate limiting
- [ ] Add comprehensive error handling
- [ ] Set up logging and monitoring
- [ ] Write tests for all endpoints
- [ ] Configure Docker deployment
- [ ] Set up CI/CD pipeline
- [ ] Document API changes
- [ ] Plan migration strategy
- [ ] Test with production data
- [ ] Monitor performance metrics

This implementation provides a complete replacement for the YouTubei-based API using yt-dlp, with better reliability and support for all YouTube content types.