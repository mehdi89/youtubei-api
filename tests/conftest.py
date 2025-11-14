"""
Pytest configuration and fixtures for API tests
"""
import os
import sys
import pytest

# Add parent directory to path to import main
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set test environment variables before importing app
os.environ["YOUTUBE_API_KEY"] = "test-api-key-for-testing"

from fastapi.testclient import TestClient
from main import app

@pytest.fixture
def client():
    """Create a test client for the FastAPI app"""
    with TestClient(app) as test_client:
        yield test_client

@pytest.fixture
def api_key():
    """Return the test API key"""
    return "test-api-key-for-testing"

@pytest.fixture
def valid_video_id():
    """Return a valid YouTube video ID for testing"""
    return "dQw4w9WgXcQ"  # Rick Astley - Never Gonna Give You Up

@pytest.fixture
def valid_channel_id():
    """Return a valid YouTube channel ID for testing"""
    return "@Fireship"  # Fireship channel handle (more reliable than ID)

@pytest.fixture
def valid_playlist_id():
    """Return a valid YouTube playlist ID for testing"""
    return "PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf"  # Python tutorials

@pytest.fixture
def headers(api_key):
    """Return headers with API key"""
    return {"api-key": api_key}

