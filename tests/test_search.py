"""
Tests for search endpoint
"""
import pytest

def test_search_no_auth(client):
    """Test search without API key"""
    response = client.post(
        "/api/search",
        json={"query": "python tutorial"}
    )
    assert response.status_code == 401

def test_search_videos(client, headers):
    """Test video search"""
    response = client.post(
        "/api/search",
        json={"query": "python", "type": "video", "page": 1},
        headers=headers
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert len(data) <= 30  # Max 30 items per page
    
    # Check structure of first video
    video = data[0]
    assert "id" in video
    assert "title" in video
    assert "duration" in video
    assert "thumbnail" in video
    assert "viewCount" in video
    assert "uploadDate" in video
    assert "isLive" in video
    assert isinstance(video["isLive"], bool)

def test_search_pagination(client, headers):
    """Test search pagination"""
    # Get page 1
    response1 = client.post(
        "/api/search",
        json={"query": "python tutorial", "type": "video", "page": 1},
        headers=headers
    )
    assert response1.status_code == 200
    data1 = response1.json()
    
    # Get page 2
    response2 = client.post(
        "/api/search",
        json={"query": "python tutorial", "type": "video", "page": 2},
        headers=headers
    )
    assert response2.status_code == 200
    data2 = response2.json()
    
    # Pages should have different content
    if len(data1) > 0 and len(data2) > 0:
        assert data1[0]["id"] != data2[0]["id"]

def test_search_empty_query(client, headers):
    """Test search with empty query"""
    response = client.post(
        "/api/search",
        json={"query": "", "type": "video"},
        headers=headers
    )
    # Should return 404 or empty results
    assert response.status_code in [200, 404]

