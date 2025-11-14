"""
Tests for transcript endpoint
"""
import pytest

def test_transcript_no_auth(client, valid_video_id):
    """Test transcript without API key"""
    response = client.post(
        "/api/transcript",
        json={"id": valid_video_id}
    )
    assert response.status_code == 401

def test_transcript_plain(client, headers, valid_video_id):
    """Test plain transcript"""
    response = client.post(
        "/api/transcript",
        json={"id": valid_video_id, "type": "plain"},
        headers=headers
    )
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    # Transcript may be empty if not available, but key should exist
    assert isinstance(data["data"], str)

def test_transcript_timestamped(client, headers, valid_video_id):
    """Test timestamped transcript"""
    response = client.post(
        "/api/transcript",
        json={"id": valid_video_id, "type": "timestamped"},
        headers=headers
    )
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert isinstance(data["data"], str)

def test_video_languages_no_auth(client, valid_video_id):
    """Test video languages without API key"""
    response = client.post(
        "/api/video-languages",
        json={"id": valid_video_id}
    )
    assert response.status_code == 401

def test_video_languages(client, headers, valid_video_id):
    """Test available languages for video"""
    response = client.post(
        "/api/video-languages",
        json={"id": valid_video_id},
        headers=headers
    )
    # May return 200 with languages or 404 if none available
    assert response.status_code in [200, 404]
    
    if response.status_code == 200:
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            # Check structure of language object
            lang = data[0]
            assert "languageCode" in lang
            assert "name" in lang

