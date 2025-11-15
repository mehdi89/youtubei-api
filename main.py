"""
YouTube API Server - Pure Python Implementation with yt-dlp
FastAPI-based REST API for YouTube data extraction with cookie support
"""

from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import yt_dlp
import os
import sys
import logging
from datetime import datetime
import html
import json
import urllib.request

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s.%(msecs)03d 🔄 %(levelname)s: %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="YouTube API",
    description="YouTube data extraction API powered by yt-dlp",
    version="2.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Environment variables
API_KEY = os.getenv("YOUTUBE_API_KEY", "")

# Find cookies file
COOKIES_FILE = None
possible_cookie_paths = [
    "youtube_cookies.txt",
    "/app/youtube_cookies.txt",
    "./youtube_cookies.txt"
]
for cookie_path in possible_cookie_paths:
    if os.path.isfile(cookie_path):  # Check it's a file, not a directory
        COOKIES_FILE = cookie_path
        logger.info(f"✅ Found cookies file: {cookie_path}")
        break

if not COOKIES_FILE:
    logger.warning("⚠️ No cookies file found - YouTube may block requests")


# Request Models
class VideoDetailsRequest(BaseModel):
    id: str
    transcript: Optional[bool] = False
    timestamped: Optional[bool] = False

class TranscriptRequest(BaseModel):
    id: str
    type: Optional[str] = "plain"  # plain or timestamped

class VideoLanguagesRequest(BaseModel):
    id: str

class SearchRequest(BaseModel):
    type: Optional[str] = "video"
    query: str
    page: Optional[int] = 1

class ChannelRequest(BaseModel):
    id: str
    page: Optional[int] = 1

class PlaylistRequest(BaseModel):
    id: str
    page: Optional[int] = 1


# Utility Functions
def verify_api_key(api_key: Optional[str] = None) -> bool:
    """Verify API key"""
    if not API_KEY:
        return True  # If no API key is set, allow all requests
    return api_key == API_KEY


def format_count(count: Optional[int]) -> int:
    """Return count as integer"""
    if count is None:
        return 0
    return int(count)


def format_subscriber_count(count: Optional[int]) -> str:
    """Format subscriber count with 'subscribers' suffix"""
    if count is None or count == 0:
        return "0 subscribers"
    
    count = int(count)
    if count >= 1_000_000_000:
        formatted = f"{count / 1_000_000_000:.2f}".rstrip('0').rstrip('.')
        return f"{formatted}B subscribers"
    elif count >= 1_000_000:
        formatted = f"{count / 1_000_000:.2f}".rstrip('0').rstrip('.')
        return f"{formatted}M subscribers"
    elif count >= 1_000:
        formatted = f"{count / 1_000:.2f}".rstrip('0').rstrip('.')
        return f"{formatted}K subscribers"
    else:
        return f"{count} subscribers"


def format_date(date_str: Optional[str]) -> str:
    """Convert date to YYYY-MM-DD format"""
    if not date_str:
        return ""
    
    # yt-dlp typically returns YYYYMMDD format
    if len(date_str) == 8 and date_str.isdigit():
        return f"{date_str[0:4]}-{date_str[4:6]}-{date_str[6:8]}"
    
    return date_str


def decode_html_entities(text: str) -> str:
    """Decode HTML entities"""
    if not text:
        return ""
    return html.unescape(text)


def get_ytdlp_opts(extract_flat: bool = False) -> Dict[str, Any]:
    """Get yt-dlp options with cookies"""
    opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': extract_flat,
        'skip_download': True,
        'extractor_args': {
            'youtubetab': {'skip': ['authcheck']}  # Skip auth check for channels/playlists
        }
    }
    
    # Add cookies if available and is a valid file
    if COOKIES_FILE and os.path.isfile(COOKIES_FILE):
        opts['cookiefile'] = COOKIES_FILE
    
    return opts


async def get_transcript_data(video_id: str, timestamped: bool = False) -> Dict[str, Any]:
    """Get transcript data for a video"""
    try:
        opts = get_ytdlp_opts()
        opts['writesubtitles'] = True
        opts['writeautomaticsub'] = True
        opts['subtitleslangs'] = ['en']
        
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
            
            # Get subtitles
            subtitles = info.get("automatic_captions", {}) or info.get("subtitles", {})
            
            if not subtitles:
                return {
                    "transcript": "",
                    "transcript_status": {
                        "available": False,
                        "reason": "No transcripts available"
                    }
                }
            
            # Try to get English subtitles
            available_langs = list(subtitles.keys())
            transcript_lang = "en" if "en" in available_langs else available_langs[0]
            
            subtitle_data = subtitles.get(transcript_lang, [])
            if not subtitle_data:
                return {
                    "transcript": "",
                    "transcript_status": {
                        "available": False,
                        "reason": "Could not fetch transcript data"
                    }
                }
            
            # Find JSON3 format
            json_subtitle = None
            for sub in subtitle_data:
                if sub.get("ext") == "json3":
                    json_subtitle = sub
                    break
            
            if not json_subtitle:
                return {
                    "transcript": "",
                    "transcript_status": {
                        "available": False,
                        "reason": "JSON subtitle format not available"
                    }
                }
            
            # Download and parse subtitle
            subtitle_url = json_subtitle.get("url")
            if not subtitle_url:
                return {
                    "transcript": "",
                    "transcript_status": {
                        "available": False,
                        "reason": "Subtitle URL not found"
                    }
                }
            
            with urllib.request.urlopen(subtitle_url, timeout=10) as response:
                subtitle_content = response.read().decode('utf-8')
                subtitle_json = json.loads(subtitle_content)
            
            # Parse events
            plain_text_parts = []
            timestamped_array = []
            
            events = subtitle_json.get("events", [])
            for event in events:
                segs = event.get("segs")
                if not segs:
                    continue
                
                text = "".join([seg.get("utf8", "") for seg in segs])
                text = text.strip()
                
                if text:
                    plain_text_parts.append(text)
                    
                    start_ms = event.get("tStartMs", 0)
                    duration_ms = event.get("dDurationMs", 0)
                    
                    timestamped_array.append({
                        "text": text,
                        "offset": start_ms / 1000.0,
                        "duration": duration_ms / 1000.0
                    })
            
            plain_transcript = " ".join(plain_text_parts)
            
            timestamped_parts = []
            for entry in timestamped_array:
                timestamped_parts.append(f"time : {entry['offset']} second. Text: {entry['text']}")
            timestamped_transcript = "".join(timestamped_parts)
            
            return {
                "transcript": plain_transcript,
                "transcript_status": {
                    "available": True,
                    "reason": None
                },
                "timestamped_transcript": timestamped_transcript,
                "timestamped_transcript_array": timestamped_array,
                "timestamped_transcript_status": {
                    "available": True,
                    "reason": None,
                    "language": transcript_lang,
                    "available_languages": available_langs
                }
            }
            
    except Exception as e:
        logger.error(f"❌ ERROR: Failed to parse transcript: {str(e)}")
        return {
            "transcript": "",
            "transcript_status": {
                "available": False,
                "reason": f"Failed to parse transcript: {str(e)}"
            }
        }


# API Endpoints
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "YouTube API Server",
        "version": "2.0.0",
        "powered_by": "yt-dlp",
        "cookies_enabled": COOKIES_FILE is not None,
        "endpoints": [
            "/api/video-details",
            "/api/transcript",
            "/api/video-languages",
            "/api/search",
            "/api/channel-details",
            "/api/channel-videos",
            "/api/channel-live-videos",
            "/api/playlist",
            "/api/channel"
        ]
    }


@app.get("/api/hello")
async def hello():
    """Health check endpoint"""
    return {
        "message": "Hello from YouTube API",
        "cookies_enabled": COOKIES_FILE is not None
    }


@app.post("/api/video-details")
async def video_details(
    request: VideoDetailsRequest,
    api_key: Optional[str] = Header(None, alias="api-key")
):
    """Get video details"""
    if not verify_api_key(api_key):
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    logger.info(f"🔄 FETCH: Video {request.id}")
    
    try:
        opts = get_ytdlp_opts()
        opts['writesubtitles'] = request.transcript
        opts['writeautomaticsub'] = request.transcript
        
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(f"https://www.youtube.com/watch?v={request.id}", download=False)
            
            if not info:
                raise HTTPException(status_code=404, detail="Video not found or may have been removed")
            
            # Build response
            response = {
                "id": info.get("id", request.id),
                "channel": {
                    "id": info.get("channel_id", ""),
                    "youtube_channel_id": info.get("channel_id", ""),
                    "name": info.get("channel", "") or info.get("uploader", ""),
                    "subscriberCount": format_subscriber_count(info.get("channel_follower_count")),
                    "thumbnails": [{"url": thumb} for thumb in (info.get("thumbnails", [{}])[-1:] if info.get("thumbnails") else [])],
                    "videoCount": 0,
                    "url": info.get("channel_url", "")
                },
                "title": decode_html_entities(info.get("title", "")),
                "chapters": info.get("chapters", []),
                "description": decode_html_entities(info.get("description", "")),
                "duration": info.get("duration", 0),
                "likeCount": format_count(info.get("like_count")),
                "isLiveContent": info.get("is_live", False) or info.get("was_live", False),
                "uploadDate": format_date(info.get("upload_date", "")),
                "viewCount": format_count(info.get("view_count")),
            }
            
            # Add transcript if requested
            if request.transcript:
                transcript_data = await get_transcript_data(request.id, request.timestamped)
                response.update(transcript_data)
            
            logger.info(f"✅ SUCCESS: Video {request.id} | {response['title']}")
            return response
            
    except yt_dlp.utils.DownloadError as e:
        error_msg = str(e)
        logger.error(f"❌ ERROR: Failed to fetch video {request.id} | {error_msg}")
        if "Sign in to confirm" in error_msg or "bot" in error_msg.lower():
            raise HTTPException(status_code=403, detail="YouTube bot detection - cookies may be expired")
        raise HTTPException(status_code=404, detail="Video not found or unavailable")
    except Exception as e:
        logger.error(f"❌ ERROR: Failed to fetch video {request.id} | {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/transcript")
async def transcript(
    request: TranscriptRequest,
    api_key: Optional[str] = Header(None, alias="api-key")
):
    """Get video transcript"""
    if not verify_api_key(api_key):
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    logger.info(f"🔄 FETCH: Transcript for {request.id}")
    
    try:
        transcript_data = await get_transcript_data(request.id, request.type == "timestamped")
        transcript_text = transcript_data.get("transcript", "")
        
        if request.type == "timestamped":
            transcript_text = transcript_data.get("timestamped_transcript", "")
        
        logger.info(f"✅ SUCCESS: Transcript {request.id} | Length: {len(transcript_text)}")
        return {"data": transcript_text}
        
    except Exception as e:
        logger.error(f"❌ ERROR: Failed to fetch transcript {request.id} | {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/video-languages")
async def video_languages(
    request: VideoLanguagesRequest,
    api_key: Optional[str] = Header(None, alias="api-key")
):
    """Get available caption languages for a video"""
    if not verify_api_key(api_key):
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    logger.info(f"🔄 FETCH: Languages for {request.id}")
    
    try:
        opts = get_ytdlp_opts()
        
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(f"https://www.youtube.com/watch?v={request.id}", download=False)
            
            subtitles = info.get("automatic_captions", {}) or info.get("subtitles", {})
            
            if not subtitles:
                raise HTTPException(status_code=404, detail="No languages available for this video")
            
            # Language code to name mapping
            lang_names = {
                "en": "English", "es": "Spanish", "fr": "French", "de": "German",
                "it": "Italian", "pt": "Portuguese", "ru": "Russian", "ja": "Japanese",
                "ko": "Korean", "zh": "Chinese", "ar": "Arabic", "hi": "Hindi",
            }
            
            languages = []
            for lang_code in subtitles.keys():
                base_lang = lang_code.split('-')[0]
                name = lang_names.get(base_lang, lang_code.upper())
                
                languages.append({
                    "languageCode": lang_code,
                    "name": name
                })
            
            logger.info(f"✅ SUCCESS: Found {len(languages)} languages for {request.id}")
            return languages
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ ERROR: Failed to fetch languages {request.id} | {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/search")
async def search(
    request: SearchRequest,
    api_key: Optional[str] = Header(None, alias="api-key")
):
    """Search YouTube"""
    if not verify_api_key(api_key):
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    logger.info(f"🔄 FETCH: Search '{request.query}' | Type: {request.type} | Page: {request.page}")
    
    try:
        # Handle empty query
        if not request.query or not request.query.strip():
            logger.warning(f"⚠️ WARN: Empty search query")
            return []
        
        items_per_page = 30
        max_results = request.page * items_per_page + 30
        
        opts = get_ytdlp_opts(extract_flat=True)
        opts['playlistend'] = max_results
        
        search_query = f"ytsearch{max_results}:{request.query}"
        
        with yt_dlp.YoutubeDL(opts) as ydl:
            result = ydl.extract_info(search_query, download=False)
            
            if not result or 'entries' not in result:
                logger.info(f"ℹ️ INFO: No results found for '{request.query}'")
                return []
            
            entries = result['entries']
            
            # Paginate
            start_idx = (request.page - 1) * items_per_page
            end_idx = request.page * items_per_page
            paginated_entries = entries[start_idx:end_idx]
            
            results = []
            for item in paginated_entries:
                if not item:
                    continue
                
                results.append({
                    "id": item.get("id", ""),
                    "title": decode_html_entities(item.get("title", "")),
                    "duration": int(item.get("duration", 0)) if item.get("duration") else 0,
                    "description": decode_html_entities(item.get("description")) if item.get("description") else None,
                    "isLive": item.get("is_live", False),
                    "viewCount": format_count(item.get("view_count")) if item.get("view_count") else 0,
                    "uploadDate": format_date(item.get("upload_date", "")),
                    "thumbnail": f"https://img.youtube.com/vi/{item.get('id', '')}/hqdefault.jpg"
                })
            
            if not results:
                logger.info(f"ℹ️ INFO: No results found for '{request.query}'")
                return []
            
            logger.info(f"✅ SUCCESS: Found {len(results)} results for '{request.query}'")
            return results
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ ERROR: Search failed '{request.query}' | {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/channel-details")
@app.post("/api/channel")
async def channel_details(
    request: ChannelRequest,
    api_key: Optional[str] = Header(None, alias="api-key")
):
    """Get channel details"""
    if not verify_api_key(api_key):
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    logger.info(f"🔄 FETCH: Channel {request.id}")
    
    try:
        urls_to_try = [
            f"https://www.youtube.com/channel/{request.id}",
            f"https://www.youtube.com/@{request.id}",
            f"https://www.youtube.com/c/{request.id}",
        ]
        
        opts = get_ytdlp_opts(extract_flat=True)
        opts['playlistend'] = 1
        
        info = None
        for url in urls_to_try:
            try:
                with yt_dlp.YoutubeDL(opts) as ydl:
                    info = ydl.extract_info(url, download=False)
                    if info:
                        break
            except:
                continue
        
        if not info:
            raise HTTPException(status_code=404, detail="Channel not found")
        
        response = {
            "id": info.get("channel_id", request.id),
            "youtube_channel_id": info.get("channel_id", request.id),
            "name": info.get("channel", "") or info.get("uploader", ""),
            "description": decode_html_entities(info.get("description", "")),
            "isVerified": info.get("channel_is_verified", False),
            "subscriberCount": format_subscriber_count(info.get("channel_follower_count")),
            "thumbnail": info.get("thumbnails", [{}])[-1].get("url", "") if info.get("thumbnails") else "",
            "banner": "",
            "joinedDate": "",
            "location": "",
            "videosCount": 0,
            "viewCount": str(format_count(info.get("view_count"))),
            "keywords": info.get("tags", []),
            "isFamilySafe": True,
            "availableCountryCodes": []
        }
        
        logger.info(f"✅ SUCCESS: Channel {request.id} | {response['name']}")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ ERROR: Failed to fetch channel {request.id} | {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/channel-videos")
async def channel_videos(
    request: ChannelRequest,
    api_key: Optional[str] = Header(None, alias="api-key")
):
    """Get channel videos"""
    if not verify_api_key(api_key):
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    logger.info(f"🔄 FETCH: Channel videos {request.id} | Page: {request.page}")
    
    try:
        items_per_page = 30
        max_items = request.page * items_per_page + 30
        
        # Try multiple URL patterns for better compatibility
        urls_to_try = [
            f"https://www.youtube.com/{request.id}/videos",  # Try as-is first (handles @username)
            f"https://www.youtube.com/channel/{request.id}/videos",  # Try as channel ID
            f"https://www.youtube.com/@{request.id}/videos",  # Try with @ prefix
            f"https://www.youtube.com/c/{request.id}/videos",  # Try as custom URL
        ]
        
        opts = get_ytdlp_opts(extract_flat=True)
        opts['playlistend'] = max_items
        
        info = None
        last_error = None
        
        for url in urls_to_try:
            try:
                with yt_dlp.YoutubeDL(opts) as ydl:
                    info = ydl.extract_info(url, download=False)
                    if info and 'entries' in info and len(info['entries']) > 0:
                        logger.info(f"✅ SUCCESS: Channel videos found with URL: {url}")
                        break
            except Exception as e:
                last_error = str(e)
                continue
        
        if not info or 'entries' not in info:
            logger.error(f"❌ ERROR: Channel not found or has no videos: {request.id} | Last error: {last_error}")
            raise HTTPException(status_code=404, detail="Channel not found or has no videos")
        
        entries = [e for e in info['entries'] if e]
        
        # Paginate
        start_idx = (request.page - 1) * items_per_page
        end_idx = request.page * items_per_page
        paginated_entries = entries[start_idx:end_idx]
        
        results = []
        for item in paginated_entries:
            results.append({
                "id": item.get("id", ""),
                "title": decode_html_entities(item.get("title", "")),
                "duration": int(item.get("duration", 0)) if item.get("duration") else 0,
                "description": decode_html_entities(item.get("description")) if item.get("description") else None,
                "isLive": item.get("is_live", False),
                "viewCount": format_count(item.get("view_count")) if item.get("view_count") else 0,
                "uploadDate": format_date(item.get("upload_date", "")),
                "thumbnail": f"https://img.youtube.com/vi/{item.get('id', '')}/hqdefault.jpg",
                "channelName": item.get("channel", "") or item.get("uploader", ""),
                "channelID": item.get("channel_id", request.id)
            })
        
        logger.info(f"✅ SUCCESS: Found {len(results)} videos for channel {request.id}")
        return results
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ ERROR: Failed to fetch channel videos {request.id} | {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/channel-live-videos")
async def channel_live_videos(
    request: ChannelRequest,
    api_key: Optional[str] = Header(None, alias="api-key")
):
    """Get channel live videos"""
    if not verify_api_key(api_key):
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    logger.info(f"🔄 FETCH: Channel live videos {request.id}")
    
    try:
        # Try to get live/streams page first
        urls_to_try = [
            f"https://www.youtube.com/{request.id}/streams",
            f"https://www.youtube.com/channel/{request.id}/streams",
            f"https://www.youtube.com/@{request.id}/streams",
            f"https://www.youtube.com/c/{request.id}/streams",
        ]
        
        opts = get_ytdlp_opts(extract_flat=True)
        opts['playlistend'] = 30
        
        live_videos = []
        
        # Try streams page first
        for url in urls_to_try:
            try:
                with yt_dlp.YoutubeDL(opts) as ydl:
                    info = ydl.extract_info(url, download=False)
                    if info and 'entries' in info:
                        live_videos = [
                            {
                                "id": item.get("id", ""),
                                "title": decode_html_entities(item.get("title", "")),
                                "duration": int(item.get("duration", 0)) if item.get("duration") else 0,
                                "description": decode_html_entities(item.get("description")) if item.get("description") else None,
                                "isLive": True,
                                "viewCount": format_count(item.get("view_count")) if item.get("view_count") else 0,
                                "uploadDate": format_date(item.get("upload_date", "")),
                                "thumbnail": f"https://img.youtube.com/vi/{item.get('id', '')}/hqdefault.jpg",
                                "channelName": item.get("channel", "") or item.get("uploader", ""),
                                "channelID": item.get("channel_id", request.id)
                            }
                            for item in info['entries'] if item and item.get("is_live", False)
                        ]
                        if live_videos:
                            break
            except:
                continue
        
        # If no live videos found on streams page, return empty array
        logger.info(f"✅ SUCCESS: Found {len(live_videos)} live videos for channel {request.id}")
        return live_videos
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ ERROR: Failed to fetch live videos {request.id} | {str(e)}")
        # Return empty array instead of error for live videos (common to have none)
        return []


@app.post("/api/playlist")
async def playlist(
    request: PlaylistRequest,
    api_key: Optional[str] = Header(None, alias="api-key")
):
    """Get playlist videos"""
    if not verify_api_key(api_key):
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    logger.info(f"🔄 FETCH: Playlist {request.id} | Page: {request.page}")
    
    try:
        items_per_page = 30
        max_items = request.page * items_per_page + 30
        
        opts = get_ytdlp_opts(extract_flat=True)
        opts['playlistend'] = max_items
        
        url = f"https://www.youtube.com/playlist?list={request.id}"
        
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            if not info or 'entries' not in info:
                logger.error(f"❌ ERROR: Playlist not found: {request.id}")
                raise HTTPException(status_code=404, detail="Playlist not found")
            
            entries = [e for e in info['entries'] if e]
            
            # Paginate
            start_idx = (request.page - 1) * items_per_page
            end_idx = request.page * items_per_page
            paginated_entries = entries[start_idx:end_idx]
            
            results = []
            for item in paginated_entries:
                results.append({
                    "id": item.get("id", ""),
                    "title": decode_html_entities(item.get("title", "")),
                    "duration": int(item.get("duration", 0)) if item.get("duration") else 0,
                    "description": decode_html_entities(item.get("description")) if item.get("description") else None,
                    "isLive": item.get("is_live", False),
                    "viewCount": format_count(item.get("view_count")) if item.get("view_count") else 0,
                    "uploadDate": format_date(item.get("upload_date", "")),
                    "thumbnail": f"https://img.youtube.com/vi/{item.get('id', '')}/hqdefault.jpg",
                    "channelName": item.get("channel", "") or item.get("uploader", ""),
                    "channelID": item.get("channel_id", "")
                })
            
            logger.info(f"✅ SUCCESS: Found {len(results)} videos in playlist {request.id}")
            return results
            
    except yt_dlp.utils.DownloadError as e:
        logger.error(f"❌ ERROR: Playlist not found: {request.id}")
        raise HTTPException(status_code=404, detail="Playlist not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ ERROR: Failed to fetch playlist {request.id} | {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"message": exc.detail}
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"❌ Unhandled error: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"message": "Internal Server Error"}
    )


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 3000))
    logger.info(f"🚀 Starting server on port {port}")
    logger.info(f"🍪 Cookies: {'Enabled' if COOKIES_FILE else 'Disabled'}")
    uvicorn.run(app, host="0.0.0.0", port=port)
