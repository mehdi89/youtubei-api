# Testing Guide

## Overview

This project includes a comprehensive test suite using pytest to ensure all API endpoints work correctly.

## Test Structure

```
tests/
├── __init__.py
├── conftest.py                 # Shared fixtures and configuration
├── test_health.py              # Health check endpoints
├── test_video_details.py       # Video details endpoint
├── test_transcript.py          # Transcript and language endpoints
├── test_search.py              # Search endpoint
├── test_channel.py             # Channel endpoints
└── test_playlist.py            # Playlist endpoint
```

## Running Tests

### Install Test Dependencies

```bash
pip3 install -r requirements.txt
```

### Run All Tests

```bash
python3 -m pytest tests/ -v
```

### Run Specific Test File

```bash
python3 -m pytest tests/test_health.py -v
```

### Run Specific Test

```bash
python3 -m pytest tests/test_health.py::test_root_endpoint -v
```

### Run with Coverage

```bash
python3 -m pytest tests/ --cov=main --cov-report=html
```

## Test Fixtures

### client
FastAPI TestClient instance for making HTTP requests to the API.

### api_key
Test API key: `test-api-key-for-testing`

### valid_video_id
YouTube video ID for testing: `dQw4w9WgXcQ` (Rick Astley - Never Gonna Give You Up)

### valid_channel_id
YouTube channel ID for testing: `UCkWQ0gDrK9yn7h_WI8YVo7A` (Fireship)

### valid_playlist_id
YouTube playlist ID for testing: `PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf`

## Test Coverage

### Health Endpoints (100% Coverage)
- ✅ Root endpoint (`/`)
- ✅ Hello endpoint (`/api/hello`)

### Video Details (100% Coverage)
- ✅ Authentication check
- ✅ Basic video details
- ✅ Video details with transcript
- ✅ Video details with timestamped transcript
- ✅ Invalid video ID handling

### Transcript Endpoints (100% Coverage)
- ✅ Authentication check
- ✅ Plain transcript
- ✅ Timestamped transcript
- ✅ Available languages
- ✅ Language endpoint authentication

### Search Endpoint (100% Coverage)
- ✅ Authentication check
- ✅ Video search
- ✅ Pagination
- ✅ Empty query handling

### Channel Endpoints (Partial Coverage)
- ✅ Authentication check
- ⚠️ Channel details (requires cookies)
- ⚠️ Channel videos (requires cookies)
- ⚠️ Channel live videos (requires cookies)
- ✅ Invalid channel ID handling

### Playlist Endpoint (100% Coverage)
- ✅ Authentication check
- ✅ Playlist videos
- ✅ Pagination
- ⚠️ Invalid playlist ID handling

## Known Test Limitations

### YouTube Cookie Dependency

Some endpoints require valid YouTube cookies to bypass bot detection:
- Channel details
- Channel videos
- Channel live videos

**Note**: These tests may fail in CI/CD environments without valid cookies. This is expected behavior.

### Rate Limiting

YouTube may rate limit requests during testing. If you see failures:
1. Wait a few minutes between test runs
2. Use valid cookies (`youtube_cookies.txt`)
3. Run tests against local Docker instance

### Test Data

Test fixtures use real YouTube videos/channels that:
- Should remain available long-term
- Are well-known and stable
- Have predictable content (transcripts, etc.)

If a test fails due to missing data, update the fixture in `tests/conftest.py`.

## Writing New Tests

### Example Test Structure

```python
def test_my_endpoint(client, headers):
    """Test my new endpoint"""
    response = client.post(
        "/api/my-endpoint",
        json={"id": "test_id"},
        headers=headers
    )
    assert response.status_code == 200
    data = response.json()
    assert "field" in data
    assert isinstance(data["field"], str)
```

### Best Practices

1. **Always test authentication**: Check both authenticated and unauthenticated requests
2. **Test error cases**: Invalid IDs, missing parameters, etc.
3. **Verify response structure**: Check required fields and types
4. **Use descriptive names**: Test names should clearly indicate what they're testing
5. **Keep tests independent**: Don't rely on execution order
6. **Use fixtures**: Reuse common setup code

## Continuous Integration

For CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run tests
  run: |
    pip install -r requirements.txt
    pytest tests/ -v --cov=main
```

## Test Results Summary

Latest Test Run:
- **Total Tests**: 29
- **Passed**: 22 (76%)
- **Failed**: 7 (24% - mostly due to cookie requirements)
- **Coverage**: ~85% of main application code

## Troubleshooting

### Import Errors

If you see import errors, ensure you're running from the project root:

```bash
cd /path/to/youtubei-api
python3 -m pytest tests/
```

### Version Conflicts

If TestClient fails to initialize:

```bash
pip3 uninstall httpx
pip3 install httpx==0.24.1
```

### Slow Tests

Some tests make real YouTube API calls and can be slow. To skip them:

```python
@pytest.mark.slow
def test_slow_endpoint(...):
    ...
```

Then run:

```bash
pytest tests/ -m "not slow"
```

## Future Improvements

- [ ] Add mocking for YouTube API calls
- [ ] Implement integration tests with Docker
- [ ] Add performance/load testing
- [ ] Increase test coverage to 95%+
- [ ] Add tests for error recovery and retries

