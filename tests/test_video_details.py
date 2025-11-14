"""
Tests for video details endpoint
"""
import pytest

def test_video_details_no_auth(client, valid_video_id):
    """Test video details without API key"""
    response = client.post(
        "/api/video-details",
        json={"id": valid_video_id}
    )
    assert response.status_code == 401
    assert "Invalid API key" in response.json()["message"]

def test_video_details_basic(client, headers, valid_video_id):
    """Test basic video details without transcript"""
    response = client.post(
        "/api/video-details",
        json={"id": valid_video_id, "transcript": False},
        headers=headers
    )
    assert response.status_code == 200
    data = response.json()
    
    # Check required fields
    assert "id" in data
    assert data["id"] == valid_video_id
    assert "title" in data
    assert isinstance(data["title"], str)
    assert len(data["title"]) > 0
    assert "duration" in data
    assert isinstance(data["duration"], int)
    assert "viewCount" in data
    assert isinstance(data["viewCount"], int)
    assert "likeCount" in data
    assert isinstance(data["likeCount"], int)
    assert "uploadDate" in data
    assert "description" in data
    assert "isLiveContent" in data
    assert isinstance(data["isLiveContent"], bool)
    
    # Check channel object
    assert "channel" in data
    channel = data["channel"]
    assert "id" in channel
    assert "name" in channel
    assert "subscriberCount" in channel
    assert "subscribers" in channel["subscriberCount"]
    assert "url" in channel

def test_video_details_with_transcript(client, headers, valid_video_id):
    """Test video details with transcript"""
    response = client.post(
        "/api/video-details",
        json={"id": valid_video_id, "transcript": True, "timestamped": False},
        headers=headers
    )
    assert response.status_code == 200
    data = response.json()
    
    assert "transcript" in data or "transcript_status" in data
    if "transcript_status" in data:
        assert "available" in data["transcript_status"]

def test_video_details_with_timestamped(client, headers, valid_video_id):
    """Test video details with timestamped transcript"""
    response = client.post(
        "/api/video-details",
        json={"id": valid_video_id, "transcript": True, "timestamped": True},
        headers=headers
    )
    assert response.status_code == 200
    data = response.json()
    
    if data.get("timestamped_transcript_status", {}).get("available"):
        assert "timestamped_transcript_array" in data
        if data["timestamped_transcript_array"]:
            assert isinstance(data["timestamped_transcript_array"], list)
            # Check first entry structure
            entry = data["timestamped_transcript_array"][0]
            assert "text" in entry
            assert "offset" in entry
            assert "duration" in entry

def test_video_details_invalid_id(client, headers):
    """Test video details with invalid video ID"""
    response = client.post(
        "/api/video-details",
        json={"id": "invalid_id_123"},
        headers=headers
    )
    # Should return 404 or 500 depending on yt-dlp response
    assert response.status_code in [404, 500]

