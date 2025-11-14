"""
Tests for playlist endpoint
"""
import pytest

def test_playlist_no_auth(client, valid_playlist_id):
    """Test playlist without API key"""
    response = client.post(
        "/api/playlist",
        json={"id": valid_playlist_id}
    )
    assert response.status_code == 401

def test_playlist_videos(client, headers, valid_playlist_id):
    """Test playlist videos"""
    response = client.post(
        "/api/playlist",
        json={"id": valid_playlist_id, "page": 1},
        headers=headers
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) <= 30  # Max 30 items per page
    
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
        assert isinstance(video["isLive"], bool)

def test_playlist_pagination(client, headers, valid_playlist_id):
    """Test playlist pagination"""
    # Get page 1
    response1 = client.post(
        "/api/playlist",
        json={"id": valid_playlist_id, "page": 1},
        headers=headers
    )
    assert response1.status_code == 200
    data1 = response1.json()
    
    # Get page 2
    response2 = client.post(
        "/api/playlist",
        json={"id": valid_playlist_id, "page": 2},
        headers=headers
    )
    assert response2.status_code == 200
    data2 = response2.json()
    assert isinstance(data2, list)
    
    # If both pages have data, they should be different
    if len(data1) > 0 and len(data2) > 0:
        assert data1[0]["id"] != data2[0]["id"]

def test_playlist_invalid_id(client, headers):
    """Test playlist with invalid ID"""
    response = client.post(
        "/api/playlist",
        json={"id": "invalid_playlist_123"},
        headers=headers
    )
    # Should return 404 for invalid playlist
    assert response.status_code == 404
    data = response.json()
    assert "message" in data
    assert "not found" in data["message"].lower()

