"""
Tests for health check endpoints
"""
import pytest

def test_root_endpoint(client):
    """Test the root endpoint"""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert data["message"] == "YouTube API Server"
    assert "version" in data
    assert "powered_by" in data
    assert data["powered_by"] == "yt-dlp"
    assert "cookies_enabled" in data
    assert "endpoints" in data
    assert isinstance(data["endpoints"], list)
    assert len(data["endpoints"]) > 0

def test_hello_endpoint(client):
    """Test the hello endpoint (no auth required)"""
    response = client.get("/api/hello")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "Hello from YouTube API" in data["message"]
    assert "cookies_enabled" in data

