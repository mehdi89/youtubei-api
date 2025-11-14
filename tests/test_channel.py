"""
Tests for channel endpoints
"""
import pytest

def test_channel_details_no_auth(client, valid_channel_id):
    """Test channel details without API key"""
    response = client.post(
        "/api/channel-details",
        json={"id": valid_channel_id}
    )
    assert response.status_code == 401

def test_channel_details(client, headers, valid_channel_id):
    """Test channel details"""
    response = client.post(
        "/api/channel-details",
        json={"id": valid_channel_id},
        headers=headers
    )
    assert response.status_code == 200
    data = response.json()
    
    # Check required fields
    assert "id" in data
    assert "name" in data
    assert isinstance(data["name"], str)
    assert len(data["name"]) > 0
    assert "description" in data
    assert "subscriberCount" in data
    assert "thumbnail" in data
    assert "isVerified" in data
    assert isinstance(data["isVerified"], bool)
    assert "viewCount" in data

def test_channel_endpoint_alias(client, headers, valid_channel_id):
    """Test /api/channel endpoint (alias for channel-details)"""
    response = client.post(
        "/api/channel",
        json={"id": valid_channel_id},
        headers=headers
    )
    assert response.status_code == 200
    data = response.json()
    assert "id" in data
    assert "name" in data

def test_channel_videos_no_auth(client, valid_channel_id):
    """Test channel videos without API key"""
    response = client.post(
        "/api/channel-videos",
        json={"id": valid_channel_id}
    )
    assert response.status_code == 401

def test_channel_videos(client, headers, valid_channel_id):
    """Test channel videos"""
    response = client.post(
        "/api/channel-videos",
        json={"id": valid_channel_id, "page": 1},
        headers=headers
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    
    if len(data) > 0:
        # Check structure of first video
        video = data[0]
        assert "id" in video
        assert "title" in video
        assert "duration" in video
        assert "thumbnail" in video
        assert "viewCount" in video
        assert "uploadDate" in video
        assert "channelName" in video
        assert "channelID" in video
        assert "isLive" in video

def test_channel_videos_pagination(client, headers, valid_channel_id):
    """Test channel videos pagination"""
    response = client.post(
        "/api/channel-videos",
        json={"id": valid_channel_id, "page": 2},
        headers=headers
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)

def test_channel_live_videos_no_auth(client, valid_channel_id):
    """Test channel live videos without API key"""
    response = client.post(
        "/api/channel-live-videos",
        json={"id": valid_channel_id}
    )
    assert response.status_code == 401

def test_channel_live_videos(client, headers, valid_channel_id):
    """Test channel live videos"""
    response = client.post(
        "/api/channel-live-videos",
        json={"id": valid_channel_id},
        headers=headers
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    
    # Verify all returned videos are live
    for video in data:
        assert video.get("isLive") == True

def test_channel_invalid_id(client, headers):
    """Test channel with invalid ID"""
    response = client.post(
        "/api/channel-details",
        json={"id": "invalid_channel_123"},
        headers=headers
    )
    assert response.status_code == 404

