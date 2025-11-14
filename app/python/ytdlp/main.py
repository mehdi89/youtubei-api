"""YouTube API using yt-dlp - 100% compatible drop-in replacement"""
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Any, Dict
import os
from dotenv import load_dotenv
import yt_dlp
import logging

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="YouTube API (yt-dlp)", version="2.0.0")

# CORS configuration - same as original
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Key validation
API_KEY = os.getenv("YOUTUBE_API_KEY", "default_key")

def verify_api_key(api_key: str = Header(None, alias="api-key")):
    """Verify API key - matches original implementation"""
    if api_key != API_KEY:
        raise HTTPException(
            status_code=401, 
            detail={"message": "Please provide correct API key"}
        )
    return api_key

# Request Models - Compatible with both formats
class VideoDetailsRequest(BaseModel):
    # Support both field names
    id: Optional[str] = None
    videoId: Optional[str] = None
    includeTranscript: Optional[bool] = False

class TranscriptRequest(BaseModel):
    videoId: str
    lang: Optional[str] = "en"
    format: Optional[str] = "plain"

class SearchRequest(BaseModel):
    # Original API format
    type: Optional[str] = "video"
    query: Optional[str] = None
    # App's format 
    q: Optional[str] = None
    page: Optional[int] = 1
    # Additional app fields (ignored but accepted)
    source: Optional[str] = None
    status: Optional[str] = None
    sort_by: Optional[str] = None
    sort_order: Optional[str] = None

class ChannelDetailsRequest(BaseModel):
    # Support both field names
    id: Optional[str] = None
    channelId: Optional[str] = None

class ChannelVideosRequest(BaseModel):
    # Support both field names
    id: Optional[str] = None
    channelId: Optional[str] = None
    page: Optional[int] = 1
    tab: Optional[str] = "videos"

class VideoLanguagesRequest(BaseModel):
    # Support both field names
    id: Optional[str] = None
    videoId: Optional[str] = None

class PlaylistRequest(BaseModel):
    # Support both field names
    id: Optional[str] = None
    playlistId: Optional[str] = None
    page: Optional[int] = 1

# yt-dlp configuration
def get_ydl_opts(quiet=True):
    return {
        'quiet': quiet,
        'no_warnings': True,
        'skip_download': True,
        'ignoreerrors': False,
        'no_check_certificate': True,
        'geo_bypass': True,
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'referer': 'https://www.youtube.com/',
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "youtube-api-ytdlp"}

@app.post("/api/video-details")
async def get_video_details(
    request: VideoDetailsRequest, 
    api_key: str = Header(None, alias="api-key")
):
    """Get video details - 100% compatible with original API"""
    verify_api_key(api_key)
    
    video_id = request.id or request.videoId
    if not video_id:
        raise HTTPException(status_code=400, detail={"message": "Video ID is required"})
    url = f"https://www.youtube.com/watch?v={video_id}"
    ydl_opts = get_ydl_opts()
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(url, download=False)
            
            # Format response to match original API exactly
            response = {
                "id": info.get('id'),
                "title": info.get('title'),
                "description": info.get('description'),
                "duration": info.get('duration'),  # Return as number of seconds
                "uploadDate": info.get('upload_date'),
                "viewCount": info.get('view_count'),
                "likeCount": info.get('like_count'),
                "isLive": info.get('is_live', False),
                "isLiveContent": info.get('is_live', False),
                "channel": {
                    "id": info.get('channel_id'),
                    "name": info.get('channel') or info.get('uploader'),
                    "subscriberCount": None
                },
                "thumbnail": f"https://img.youtube.com/vi/{info.get('id')}/maxresdefault.jpg",
                "availableQualities": [],
                "category": info.get('categories', [None])[0] if info.get('categories') else None,
                "tags": info.get('tags', []),
                "chapters": []
            }
            
            # Add subscriber count if available
            if info.get('channel_follower_count'):
                count = info.get('channel_follower_count')
                if count >= 1_000_000:
                    response['channel']['subscriberCount'] = f"{count/1_000_000:.1f}M"
                elif count >= 1_000:
                    response['channel']['subscriberCount'] = f"{count/1_000:.1f}K"
                else:
                    response['channel']['subscriberCount'] = str(count)
            
            # Handle transcript if requested
            if request.includeTranscript:
                response['transcript'] = None
                response['transcript_status'] = 'no_transcript'
            
            return response
            
        except Exception as e:
            logging.error(f"Error fetching video: {str(e)}")
            raise HTTPException(
                status_code=404,
                detail={"message": "Video not found"}
            )

@app.post("/api/transcript")
async def get_transcript(
    request: TranscriptRequest,
    api_key: str = Header(None, alias="api-key")
):
    """Get video transcript - compatible with original API"""
    verify_api_key(api_key)
    
    url = f"https://www.youtube.com/watch?v={request.videoId}"
    ydl_opts = get_ydl_opts()
    ydl_opts['writesubtitles'] = True
    ydl_opts['writeautomaticsub'] = True
    ydl_opts['subtitleslangs'] = [request.lang]
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(url, download=False)
            
            # Get subtitles/captions
            subtitles = info.get('subtitles', {})
            auto_captions = info.get('automatic_captions', {})
            
            transcript_text = ""
            
            # Try to get transcript in requested language
            if request.lang in subtitles:
                # Manual subtitles available
                for sub in subtitles[request.lang]:
                    if sub.get('ext') == 'json3':
                        # Process JSON format
                        import requests
                        resp = requests.get(sub['url'])
                        if resp.status_code == 200:
                            import json
                            data = resp.json()
                            events = data.get('events', [])
                            for event in events:
                                if 'segs' in event:
                                    for seg in event['segs']:
                                        if 'utf8' in seg:
                                            transcript_text += seg['utf8'] + " "
                            break
            elif request.lang in auto_captions:
                # Auto-generated captions
                for sub in auto_captions[request.lang]:
                    if sub.get('ext') == 'json3':
                        import requests
                        resp = requests.get(sub['url'])
                        if resp.status_code == 200:
                            import json
                            data = resp.json()
                            events = data.get('events', [])
                            for event in events:
                                if 'segs' in event:
                                    for seg in event['segs']:
                                        if 'utf8' in seg:
                                            transcript_text += seg['utf8'] + " "
                            break
            
            if transcript_text:
                return {"transcript": transcript_text.strip()}
            else:
                return {"transcript": None, "message": "No transcript available"}
                
        except Exception as e:
            logging.error(f"Error fetching transcript: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail={"message": "Failed to fetch transcript"}
            )

@app.post("/api/search")
async def search(
    request: SearchRequest,
    api_key: str = Header(None, alias="api-key")
):
    """Search videos/channels/playlists - compatible with both API formats"""
    verify_api_key(api_key)
    
    # Support both 'query' and 'q' field names
    search_query = request.query or request.q
    if not search_query:
        raise HTTPException(
            status_code=400,
            detail={"message": "Search query is required"}
        )
    
    search_type = request.type or "video"
    page = request.page or 1
    
    # Calculate items to fetch based on page
    items_per_page = 20
    max_results = page * items_per_page
    
    ydl_opts = get_ydl_opts()
    ydl_opts['extract_flat'] = True
    ydl_opts['playlistend'] = max_results
    
    # Construct search query based on type
    if search_type == "video":
        search_url = f"ytsearch{max_results}:{search_query}"
    elif search_type == "channel":
        # yt-dlp doesn't have great channel search, so we search for videos and extract channels
        search_url = f"ytsearch{max_results}:{search_query} channel"
    elif search_type == "playlist":
        search_url = f"ytsearch{max_results}:{search_query} playlist"
    else:
        raise HTTPException(
            status_code=400,
            detail={"message": "Invalid search type"}
        )
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            result = ydl.extract_info(search_url, download=False)
            entries = result.get('entries', [])
            
            # Skip to the right page
            start_index = (page - 1) * items_per_page
            page_entries = entries[start_index:start_index + items_per_page]
            
            items = []
            
            if search_type == "video":
                for entry in page_entries:
                    if entry:
                        # For flat extraction, we need to extract more info
                        if 'url' in entry:
                            video_url = entry['url']
                        else:
                            video_url = f"https://www.youtube.com/watch?v={entry.get('id')}"
                        
                        # Get full info for each video
                        try:
                            video_info = ydl.extract_info(video_url, download=False)
                            items.append({
                                'id': video_info.get('id'),
                                'title': video_info.get('title'),
                                'duration': video_info.get('duration'),
                                'description': video_info.get('description', ''),
                                'isLive': video_info.get('is_live', False),
                                'viewCount': video_info.get('view_count'),
                                'uploadDate': video_info.get('upload_date'),
                                'thumbnail': f"https://img.youtube.com/vi/{video_info.get('id')}/hqdefault.jpg",
                                'channelName': video_info.get('channel') or video_info.get('uploader'),
                                'channelID': video_info.get('channel_id'),
                                'channelThumbnail': None
                            })
                        except:
                            # Fallback to basic info
                            items.append({
                                'id': entry.get('id'),
                                'title': entry.get('title'),
                                'duration': entry.get('duration'),
                                'description': '',
                                'isLive': False,
                                'viewCount': entry.get('view_count'),
                                'uploadDate': None,
                                'thumbnail': f"https://img.youtube.com/vi/{entry.get('id')}/hqdefault.jpg",
                                'channelName': entry.get('channel') or entry.get('uploader'),
                                'channelID': entry.get('channel_id'),
                                'channelThumbnail': None
                            })
            
            elif search_type == "channel":
                # Extract unique channels from search results
                channels_seen = set()
                for entry in page_entries:
                    if entry and entry.get('channel_id'):
                        channel_id = entry.get('channel_id')
                        if channel_id not in channels_seen:
                            channels_seen.add(channel_id)
                            items.append({
                                'id': channel_id,
                                'title': entry.get('channel') or entry.get('uploader'),
                                'videoCount': None,
                                'subscriberCount': None,
                                'thumbnails': None
                            })
            
            elif search_type == "playlist":
                for entry in page_entries:
                    if entry:
                        items.append({
                            'id': entry.get('id'),
                            'title': entry.get('title'),
                            'videoCount': entry.get('playlist_count'),
                            'channelName': entry.get('channel') or entry.get('uploader'),
                            'channelID': entry.get('channel_id')
                        })
            
            return items
            
        except Exception as e:
            logging.error(f"Search failed: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail={"message": "Search failed"}
            )

@app.post("/api/channel-details")
async def get_channel_details(
    request: ChannelDetailsRequest,
    api_key: str = Header(None, alias="api-key")
):
    """Get channel details - compatible with original API"""
    verify_api_key(api_key)
    
    # Handle both @handle and channel ID formats
    channel_identifier = request.id or request.channelId
    if not channel_identifier:
        raise HTTPException(status_code=400, detail={"message": "Channel ID is required"})
    if channel_identifier.startswith('@'):
        channel_url = f"https://www.youtube.com/{channel_identifier}"
    else:
        channel_url = f"https://www.youtube.com/channel/{channel_identifier}"
    
    ydl_opts = get_ydl_opts()
    ydl_opts['extract_flat'] = True
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(channel_url, download=False)
            
            # Format subscriber count
            subscriber_count = None
            if info.get('channel_follower_count'):
                count = info.get('channel_follower_count')
                if count >= 1_000_000:
                    subscriber_count = f"{count/1_000_000:.1f}M"
                elif count >= 1_000:
                    subscriber_count = f"{count/1_000:.1f}K"
                else:
                    subscriber_count = str(count)
            
            return {
                'id': info.get('channel_id') or info.get('id'),
                'name': info.get('channel') or info.get('uploader') or info.get('title'),
                'description': info.get('description'),
                'subscriberCount': subscriber_count,
                'videosCount': info.get('playlist_count'),
                'viewCount': info.get('view_count'),
                'joinedDate': info.get('upload_date'),
                'avatar': info.get('thumbnail'),
                'banner': None,
                'isVerified': info.get('verified', False),
                'location': info.get('location'),
                'availableCountryCodes': [],
                'isFamilySafe': True,
                'keywords': info.get('tags', [])
            }
            
        except Exception as e:
            logging.error(f"Error fetching channel: {str(e)}")
            raise HTTPException(
                status_code=404,
                detail={"message": "Channel not found"}
            )

@app.post("/api/channel-videos")
async def get_channel_videos(
    request: ChannelVideosRequest,
    api_key: str = Header(None, alias="api-key")
):
    """Get channel videos/shorts/streams/playlists - compatible with original API"""
    verify_api_key(api_key)
    
    # Handle both @handle and channel ID formats
    channel_identifier = request.id or request.channelId
    if not channel_identifier:
        raise HTTPException(status_code=400, detail={"message": "Channel ID is required"})
    if channel_identifier.startswith('@'):
        base_url = f"https://www.youtube.com/{channel_identifier}"
    else:
        base_url = f"https://www.youtube.com/channel/{channel_identifier}"
    
    # Construct URL based on tab
    tab_mapping = {
        'videos': '/videos',
        'shorts': '/shorts',
        'streams': '/streams',
        'playlists': '/playlists'
    }
    
    channel_url = base_url + tab_mapping.get(request.tab, '/videos')
    
    ydl_opts = get_ydl_opts()
    ydl_opts['extract_flat'] = 'in_playlist'
    ydl_opts['playliststart'] = (request.page - 1) * 30 + 1
    ydl_opts['playlistend'] = request.page * 30
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(channel_url, download=False)
            entries = info.get('entries', [])
            
            items = []
            for entry in entries:
                if entry:
                    if request.tab == 'playlists':
                        items.append({
                            'id': entry.get('id'),
                            'title': entry.get('title'),
                            'videoCount': entry.get('playlist_count'),
                            'thumbnail': entry.get('thumbnail')
                        })
                    else:
                        items.append({
                            'id': entry.get('id'),
                            'title': entry.get('title'),
                            'duration': entry.get('duration'),
                            'isLive': entry.get('is_live', False),
                            'viewCount': entry.get('view_count'),
                            'uploadDate': entry.get('upload_date'),
                            'thumbnail': f"https://img.youtube.com/vi/{entry.get('id')}/hqdefault.jpg",
                            'channelName': entry.get('channel') or entry.get('uploader'),
                            'channelID': entry.get('channel_id')
                        })
            
            return items
            
        except Exception as e:
            logging.error(f"Error fetching channel {request.tab}: {str(e)}")
            # Return empty array for tabs that might not exist
            return []

@app.post("/api/channel-live-videos")
async def get_channel_live_videos(
    request: ChannelVideosRequest,
    api_key: str = Header(None, alias="api-key")
):
    """Get channel live videos - alias for channel-videos with streams tab"""
    request.tab = "streams"
    return await get_channel_videos(request, api_key)

@app.post("/api/video-languages")
async def get_video_languages(
    request: VideoLanguagesRequest,
    api_key: str = Header(None, alias="api-key")
):
    """Get available transcript languages - compatible with original API"""
    verify_api_key(api_key)
    
    video_id = request.id or request.videoId
    if not video_id:
        raise HTTPException(status_code=400, detail={"message": "Video ID is required"})
    url = f"https://www.youtube.com/watch?v={video_id}"
    ydl_opts = get_ydl_opts()
    ydl_opts['writesubtitles'] = True
    ydl_opts['writeautomaticsub'] = True
    ydl_opts['listsubtitles'] = True
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(url, download=False)
            
            languages = []
            
            # Manual subtitles
            subtitles = info.get('subtitles', {})
            for lang_code, subs in subtitles.items():
                languages.append({
                    'language': lang_code,
                    'isGenerated': False
                })
            
            # Auto-generated captions
            auto_captions = info.get('automatic_captions', {})
            for lang_code, subs in auto_captions.items():
                # Don't duplicate if already in manual subtitles
                if lang_code not in subtitles:
                    languages.append({
                        'language': lang_code,
                        'isGenerated': True
                    })
            
            return languages
            
        except Exception as e:
            logging.error(f"Error fetching languages: {str(e)}")
            return []

@app.post("/api/playlist")
async def get_playlist(
    request: PlaylistRequest,
    api_key: str = Header(None, alias="api-key")
):
    """Get playlist videos - compatible with original API"""
    verify_api_key(api_key)
    
    playlist_id = request.id or request.playlistId
    if not playlist_id:
        raise HTTPException(status_code=400, detail={"message": "Playlist ID is required"})
    playlist_url = f"https://www.youtube.com/playlist?list={playlist_id}"
    
    ydl_opts = get_ydl_opts()
    ydl_opts['extract_flat'] = 'in_playlist'
    ydl_opts['playliststart'] = (request.page - 1) * 30 + 1
    ydl_opts['playlistend'] = request.page * 30
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(playlist_url, download=False)
            entries = info.get('entries', [])
            
            items = []
            for entry in entries:
                if entry:
                    items.append({
                        'id': entry.get('id'),
                        'title': entry.get('title'),
                        'duration': entry.get('duration'),
                        'description': entry.get('description'),
                        'isLive': entry.get('is_live', False),
                        'viewCount': entry.get('view_count'),
                        'uploadDate': entry.get('upload_date'),
                        'thumbnail': f"https://img.youtube.com/vi/{entry.get('id')}/hqdefault.jpg",
                        'channelName': entry.get('channel') or entry.get('uploader'),
                        'channelID': entry.get('channel_id')
                    })
            
            return items
            
        except Exception as e:
            logging.error(f"Error fetching playlist: {str(e)}")
            raise HTTPException(
                status_code=404,
                detail={"message": "Playlist not found"}
            )

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "3001"))  # Default to 3001 to replace original API
    uvicorn.run(app, host="0.0.0.0", port=port)