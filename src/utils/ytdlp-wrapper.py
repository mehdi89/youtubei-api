#!/usr/bin/env python3
"""
yt-dlp wrapper service for YouTubei API compatibility.
This service provides a drop-in replacement for the youtubei npm package.
"""

import sys
import json
import subprocess
import re
from typing import Dict, List, Any, Optional
from datetime import datetime
import html


class YTDLPWrapper:
    """Wrapper class for yt-dlp that provides youtubei-compatible output."""

    def __init__(self):
        self.ytdlp_cmd = "yt-dlp"
        self.base_args = [
            "--no-check-certificate",
            "--no-warnings",
            "--quiet",
            "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "--extractor-args", "youtube:player_client=android,web",
        ]
        
        # Add cookies if available
        import os
        cookie_file = os.getenv("YTDLP_COOKIES_FILE")
        if cookie_file and os.path.exists(cookie_file):
            self.base_args.extend(["--cookies", cookie_file])
        
        # Try to use browser cookies as fallback
        browser = os.getenv("YTDLP_COOKIES_BROWSER", "chrome")
        if not cookie_file:
            # Don't fail if browser cookies aren't available
            try:
                self.base_args.extend(["--cookies-from-browser", browser])
            except:
                pass

    def _run_ytdlp(self, args: List[str]) -> Dict[str, Any]:
        """Execute yt-dlp command and return parsed JSON output."""
        try:
            cmd = [self.ytdlp_cmd] + self.base_args + args
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30
            )

            if result.returncode != 0:
                return {"error": result.stderr or "Unknown error"}

            if result.stdout.strip():
                # Handle multiple JSON objects (one per line)
                lines = result.stdout.strip().split('\n')
                if len(lines) == 1:
                    return json.loads(lines[0])
                else:
                    return [json.loads(line) for line in lines if line.strip()]

            return {"error": "No output from yt-dlp"}

        except subprocess.TimeoutExpired:
            return {"error": "Request timeout"}
        except json.JSONDecodeError as e:
            return {"error": f"JSON decode error: {str(e)}"}
        except Exception as e:
            return {"error": str(e)}

    def _format_count(self, count: Optional[int]) -> str:
        """Format large numbers to K/M/B format."""
        if count is None:
            return "0"

        count = int(count)
        if count >= 1_000_000_000:
            return f"{count / 1_000_000_000:.1f}B".rstrip('0').rstrip('.')
        elif count >= 1_000_000:
            return f"{count / 1_000_000:.1f}M".rstrip('0').rstrip('.')
        elif count >= 1_000:
            return f"{count / 1_000:.1f}K".rstrip('0').rstrip('.')
        return str(count)
    
    def _format_subscriber_count(self, count: Optional[int]) -> str:
        """Format subscriber count with 'subscribers' suffix to match production API."""
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

    def _format_date(self, date_str: Optional[str]) -> str:
        """Convert date to YYYY-MM-DD format."""
        if not date_str:
            return ""

        # yt-dlp typically returns YYYYMMDD format
        if len(date_str) == 8 and date_str.isdigit():
            return f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"

        return date_str

    def _get_thumbnail_url(self, video_id: str) -> str:
        """Generate standard YouTube thumbnail URL."""
        return f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"

    def _decode_html_entities(self, text: str) -> str:
        """Decode HTML entities in text."""
        if not text:
            return text
        return html.unescape(text)

    def get_video_details(self, video_id: str, fetch_transcript: bool = True,
                          timestamped: bool = False) -> Dict[str, Any]:
        """
        Get comprehensive video details.
        Maps to youtubei's getVideo() method.
        """
        args = [
            "--dump-json",
            "--skip-download",
            f"https://www.youtube.com/watch?v={video_id}"
        ]

        # Add subtitle args if transcript is needed
        if fetch_transcript:
            args.extend(["--write-auto-sub", "--sub-lang", "en"])

        data = self._run_ytdlp(args)

        if "error" in data:
            return {"error": data["error"]}

        # Get available subtitle languages
        available_languages = []
        if data.get("subtitles") or data.get("automatic_captions"):
            subtitles = data.get("automatic_captions", {}) or data.get("subtitles", {})
            available_languages = list(subtitles.keys())

        # Build response matching youtubei format
        response = {
            "id": video_id,
            "channel": {
                "id": data.get("channel_id", ""),
                "youtube_channel_id": data.get("channel_id", ""),
                "name": data.get("channel", "") or data.get("uploader", ""),
                "subscriberCount": self._format_subscriber_count(data.get("channel_follower_count")),
                "thumbnails": [{"url": thumb} for thumb in (data.get("thumbnails", [{}])[-1:] if data.get("thumbnails") else [])],
                "videoCount": 0,  # yt-dlp doesn't provide this in video endpoint
                "url": data.get("channel_url", "")
            },
            "title": self._decode_html_entities(data.get("title", "")),
            "chapters": data.get("chapters", []),
            "description": self._decode_html_entities(data.get("description", "")),
            "duration": data.get("duration", 0),
            "likeCount": int(data.get("like_count", 0) or 0),
            "isLiveContent": data.get("is_live", False) or data.get("was_live", False),
            "uploadDate": self._format_date(data.get("upload_date", "")),
            "viewCount": int(data.get("view_count", 0) or 0),
        }

        # Add transcript if requested
        if fetch_transcript:
            transcript_result = self.get_transcript(video_id, timestamped=timestamped)
            response.update(transcript_result)
        else:
            response["transcript_status"] = {
                "available": False,
                "reason": "Transcript not requested"
            }

        return response

    def get_transcript(self, video_id: str, timestamped: bool = False,
                       language: str = "en") -> Dict[str, Any]:
        """
        Get video transcript.
        Maps to YoutubeTranscript.fetchTranscript()
        """
        args = [
            "--write-auto-sub",
            "--sub-lang", language,
            "--skip-download",
            "--print", "filename",
            f"https://www.youtube.com/watch?v={video_id}"
        ]

        # Get video info first to check available subs
        video_data = self._run_ytdlp([
            "--dump-json",
            "--skip-download",
            f"https://www.youtube.com/watch?v={video_id}"
        ])

        if "error" in video_data:
            return {
                "transcript": "",
                "transcript_status": {
                    "available": False,
                    "reason": video_data["error"]
                }
            }

        # Get available languages
        subtitles = video_data.get("automatic_captions", {}) or video_data.get("subtitles", {})
        available_languages = list(subtitles.keys())

        if not available_languages:
            return {
                "transcript": "",
                "transcript_status": {
                    "available": False,
                    "reason": "No transcripts available"
                },
                "timestamped_transcript_status": {
                    "available": False,
                    "reason": "No transcripts available",
                    "language": None,
                    "available_languages": []
                }
            }

        # Try to get English transcript, fall back to first available
        transcript_lang = language if language in available_languages else available_languages[0]

        # Get subtitle data
        subtitle_data = subtitles.get(transcript_lang, [])
        if not subtitle_data:
            return {
                "transcript": "",
                "transcript_status": {
                    "available": False,
                    "reason": "Could not fetch transcript data"
                }
            }

        # Find JSON format subtitle URL
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

        # Download and parse the subtitle file
        try:
            import urllib.request
            subtitle_url = json_subtitle.get("url")
            
            if not subtitle_url:
                return {
                    "transcript": "",
                    "transcript_status": {
                        "available": False,
                        "reason": "Subtitle URL not found"
                    }
                }

            # Download subtitle content
            with urllib.request.urlopen(subtitle_url, timeout=10) as response:
                subtitle_content = response.read().decode('utf-8')
                subtitle_json = json.loads(subtitle_content)

            # Parse subtitle events
            plain_text_parts = []
            timestamped_array = []
            
            events = subtitle_json.get("events", [])
            for event in events:
                # Skip events without segments (usually formatting)
                segs = event.get("segs")
                if not segs:
                    continue
                
                # Extract text from segments
                text = "".join([seg.get("utf8", "") for seg in segs])
                text = text.strip()
                
                if text:
                    plain_text_parts.append(text)
                    
                    # Add timestamped entry
                    start_ms = event.get("tStartMs", 0)
                    duration_ms = event.get("dDurationMs", 0)
                    
                    timestamped_array.append({
                        "text": text,
                        "offset": start_ms / 1000.0,  # Convert to seconds
                        "duration": duration_ms / 1000.0
                    })

            plain_transcript = " ".join(plain_text_parts)
            
            # Build timestamped transcript string
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
                    "available_languages": available_languages
                }
            }

        except Exception as e:
            return {
                "transcript": "",
                "transcript_status": {
                    "available": False,
                    "reason": f"Failed to parse transcript: {str(e)}"
                },
                "timestamped_transcript_array": []
            }

    def list_transcript_languages(self, video_id: str) -> List[Dict[str, str]]:
        """
        List available transcript languages.
        Maps to YoutubeTranscript.listLanguages()
        """
        args = [
            "--list-subs",
            f"https://www.youtube.com/watch?v={video_id}"
        ]

        # Get video data to extract subtitle info
        data = self._run_ytdlp([
            "--dump-json",
            "--skip-download",
            f"https://www.youtube.com/watch?v={video_id}"
        ])

        if "error" in data:
            return []

        languages = []
        subtitles = data.get("automatic_captions", {}) or data.get("subtitles", {})

        # Language code to name mapping (common ones)
        lang_names = {
            "en": "English",
            "es": "Spanish",
            "fr": "French",
            "de": "German",
            "it": "Italian",
            "pt": "Portuguese",
            "ru": "Russian",
            "ja": "Japanese",
            "ko": "Korean",
            "zh": "Chinese",
            "ar": "Arabic",
            "hi": "Hindi",
        }

        for lang_code in subtitles.keys():
            # Extract base language code (e.g., "en-US" -> "en")
            base_lang = lang_code.split('-')[0]
            name = lang_names.get(base_lang, lang_code.upper())

            languages.append({
                "languageCode": lang_code,
                "name": name
            })

        return languages

    def search(self, query: str, search_type: str = "video",
               page: int = 1, max_results: int = 30) -> List[Dict[str, Any]]:
        """
        Search YouTube.
        Maps to youtubei's search() method.
        """
        # Calculate offset for pagination
        offset = (page - 1) * max_results
        total_to_fetch = offset + max_results

        # Build search query
        if search_type == "video":
            search_query = f"ytsearch{total_to_fetch}:{query}"
        elif search_type == "channel":
            # yt-dlp doesn't directly support channel search
            # We'll use a workaround with playlist search
            search_query = f"ytsearch{total_to_fetch}:{query} channel"
        elif search_type == "playlist":
            search_query = f"ytsearch{total_to_fetch}:{query} playlist"
        else:
            search_query = f"ytsearch{total_to_fetch}:{query}"

        args = [
            "--dump-json",
            "--skip-download",
            "--flat-playlist",
            search_query
        ]

        data = self._run_ytdlp(args)

        if "error" in data:
            return []

        # Handle single result or list
        if isinstance(data, dict) and "error" not in data:
            data = [data]

        results = []

        for item in data[offset:offset + max_results]:
            if search_type == "video":
                results.append({
                    "id": item.get("id", ""),
                    "title": self._decode_html_entities(item.get("title", "")),
                    "duration": item.get("duration", 0),
                    "description": self._decode_html_entities(item.get("description", "")),
                    "isLive": item.get("is_live", False),
                    "viewCount": self._format_count(item.get("view_count")),
                    "uploadDate": self._format_date(item.get("upload_date", "")),
                    "thumbnail": self._get_thumbnail_url(item.get("id", "")),
                    "channelName": item.get("channel", "") or item.get("uploader", ""),
                    "channelID": item.get("channel_id", ""),
                    "channelThumbnail": item.get("channel_thumbnail", "") if item.get("channel_thumbnail") else ""
                })
            elif search_type == "channel":
                results.append({
                    "id": item.get("channel_id", ""),
                    "title": item.get("channel", "") or item.get("uploader", ""),
                    "videoCount": 0,
                    "subscriberCount": self._format_count(item.get("channel_follower_count")),
                    "thumbnails": item.get("channel_thumbnail", "") if item.get("channel_thumbnail") else ""
                })
            elif search_type == "playlist":
                results.append({
                    "id": item.get("id", ""),
                    "title": self._decode_html_entities(item.get("title", "")),
                    "videoCount": item.get("playlist_count", 0),
                    "channelName": item.get("channel", "") or item.get("uploader", ""),
                    "channelID": item.get("channel_id", "")
                })

        return results

    def get_channel_details(self, channel_id: str) -> Dict[str, Any]:
        """
        Get channel details.
        Maps to youtubei's findOne(id, {type: 'channel'})
        """
        # Try both channel URL formats
        urls_to_try = [
            f"https://www.youtube.com/channel/{channel_id}",
            f"https://www.youtube.com/@{channel_id}",
            f"https://www.youtube.com/c/{channel_id}",
        ]

        data = None
        for url in urls_to_try:
            args = [
                "--dump-json",
                "--playlist-items", "1",  # Get first video to extract channel info
                "--skip-download",
                "--flat-playlist",
                url
            ]

            result = self._run_ytdlp(args)

            if "error" not in result and result:
                data = result
                break
        
        if not data or "error" in data:
            return {"error": "Channel not found"}

        # Extract channel info
        response = {
            "id": data.get("channel_id", channel_id),
            "name": data.get("channel", "") or data.get("uploader", ""),
            "description": self._decode_html_entities(data.get("description", "")),
            "isVerified": data.get("channel_is_verified", False),
            "subscriberCount": self._format_count(data.get("channel_follower_count")),
            "thumbnail": data.get("thumbnails", [{}])[-1].get("url", "") if data.get("thumbnails") else "",
            "banner": "",  # yt-dlp doesn't provide banner directly
            "joinedDate": "",  # Not available in yt-dlp
            "location": "",  # Not available in yt-dlp
            "videosCount": 0,  # Would need to fetch channel page
            "viewCount": self._format_count(data.get("view_count")),
            "keywords": data.get("tags", []),
            "isFamilySafe": True,  # Default assumption
            "availableCountryCodes": []  # Not available in yt-dlp
        }

        return response

    def get_channel_videos(self, channel_id: str, page: int = 1) -> List[Dict[str, Any]]:
        """
        Get channel videos with pagination.
        Maps to channel.videos.next(page)
        """
        urls_to_try = [
            f"https://www.youtube.com/channel/{channel_id}/videos",
            f"https://www.youtube.com/@{channel_id}/videos",
        ]

        # yt-dlp doesn't support direct pagination, so we fetch more and slice
        items_per_page = 30
        max_items = page * items_per_page + 30

        for url in urls_to_try:
            args = [
                "--dump-json",
                "--flat-playlist",
                "--playlist-end", str(max_items),
                "--skip-download",
                url
            ]

            data = self._run_ytdlp(args)

            if "error" not in data:
                break
        else:
            return []

        # Handle single result or list
        if isinstance(data, dict) and "error" not in data:
            data = [data]

        # Slice for pagination
        start_idx = (page - 1) * items_per_page
        end_idx = page * items_per_page

        results = []
        for item in data[start_idx:end_idx]:
            results.append({
                "id": item.get("id", ""),
                "title": self._decode_html_entities(item.get("title", "")),
                "duration": item.get("duration", 0),
                "description": self._decode_html_entities(item.get("description", "")),
                "isLive": item.get("is_live", False),
                "viewCount": self._format_count(item.get("view_count")),
                "uploadDate": self._format_date(item.get("upload_date", "")),
                "thumbnail": self._get_thumbnail_url(item.get("id", "")),
                "channelName": item.get("channel", "") or item.get("uploader", ""),
                "channelID": item.get("channel_id", channel_id)
            })

        return results

    def get_channel_live_videos(self, channel_id: str) -> List[Dict[str, Any]]:
        """
        Get channel's live streams.
        Maps to channel.getLiveStreams()
        """
        urls_to_try = [
            f"https://www.youtube.com/channel/{channel_id}/streams",
            f"https://www.youtube.com/@{channel_id}/streams",
        ]

        for url in urls_to_try:
            args = [
                "--dump-json",
                "--flat-playlist",
                "--skip-download",
                url
            ]

            data = self._run_ytdlp(args)

            if "error" not in data:
                break
        else:
            return []

        # Handle single result or list
        if isinstance(data, dict) and "error" not in data:
            data = [data]

        results = []
        for item in data:
            if item.get("is_live", False):
                results.append({
                    "id": item.get("id", ""),
                    "title": self._decode_html_entities(item.get("title", "")),
                    "duration": item.get("duration", 0),
                    "description": self._decode_html_entities(item.get("description", "")),
                    "isLive": True,
                    "viewCount": self._format_count(item.get("view_count")),
                    "uploadDate": self._format_date(item.get("upload_date", "")),
                    "thumbnail": self._get_thumbnail_url(item.get("id", "")),
                    "channelName": item.get("channel", "") or item.get("uploader", ""),
                    "channelID": item.get("channel_id", "")
                })

        return results

    def get_playlist_videos(self, playlist_id: str, page: int = 1) -> List[Dict[str, Any]]:
        """
        Get playlist videos with pagination.
        Maps to playlist.videos.next(page)
        """
        items_per_page = 30
        max_items = page * items_per_page + 30

        args = [
            "--dump-json",
            "--flat-playlist",
            "--playlist-end", str(max_items),
            "--skip-download",
            f"https://www.youtube.com/playlist?list={playlist_id}"
        ]

        data = self._run_ytdlp(args)

        if "error" in data:
            return []

        # Handle single result or list
        if isinstance(data, dict) and "error" not in data:
            data = [data]

        # Slice for pagination
        start_idx = (page - 1) * items_per_page
        end_idx = page * items_per_page

        results = []
        for item in data[start_idx:end_idx]:
            results.append({
                "id": item.get("id", ""),
                "title": self._decode_html_entities(item.get("title", "")),
                "duration": item.get("duration", 0),
                "description": self._decode_html_entities(item.get("description", "")),
                "isLive": item.get("is_live", False),
                "viewCount": self._format_count(item.get("view_count")),
                "uploadDate": self._format_date(item.get("upload_date", "")),
                "thumbnail": self._get_thumbnail_url(item.get("id", "")),
                "channelName": item.get("channel", "") or item.get("uploader", ""),
                "channelID": item.get("channel_id", "")
            })

        return results


def main():
    """Main entry point for the wrapper service."""
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No command provided"}))
        sys.exit(1)

    try:
        # Read command from stdin
        command_data = json.loads(sys.argv[1])

        command = command_data.get("command")
        params = command_data.get("params", {})

        wrapper = YTDLPWrapper()

        # Route to appropriate method
        if command == "getVideo":
            result = wrapper.get_video_details(
                params.get("id"),
                params.get("transcript", True),
                params.get("timestamped", False)
            )
        elif command == "getTranscript":
            result = wrapper.get_transcript(
                params.get("id"),
                params.get("timestamped", False),
                params.get("language", "en")
            )
        elif command == "listLanguages":
            result = wrapper.list_transcript_languages(params.get("id"))
        elif command == "search":
            result = wrapper.search(
                params.get("query"),
                params.get("type", "video"),
                params.get("page", 1)
            )
        elif command == "getChannelDetails":
            result = wrapper.get_channel_details(params.get("id"))
        elif command == "getChannelVideos":
            result = wrapper.get_channel_videos(
                params.get("id"),
                params.get("page", 1)
            )
        elif command == "getChannelLiveVideos":
            result = wrapper.get_channel_live_videos(params.get("id"))
        elif command == "getPlaylistVideos":
            result = wrapper.get_playlist_videos(
                params.get("id"),
                params.get("page", 1)
            )
        else:
            result = {"error": f"Unknown command: {command}"}

        print(json.dumps(result))

    except json.JSONDecodeError:
        print(json.dumps({"error": "Invalid JSON input"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
