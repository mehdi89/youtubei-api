import { createMocks } from 'node-mocks-http'

// Create mock functions at module level
const mockGetInfo = jest.fn()
const mockFetchTranscript = jest.fn()
const mockListTranscripts = jest.fn()

// Mock youtube-transcript
jest.mock('@/utils/youtube-transcript/dist/youtube-transcript.common.js', () => ({
  YoutubeTranscript: {
    fetchTranscript: mockFetchTranscript,
    listTranscripts: mockListTranscripts,
  },
}))

// Mock the shared innertube utility
jest.mock('@/utils/innertube', () => ({
  getInnertube: jest.fn().mockImplementation(() => Promise.resolve({
    getInfo: mockGetInfo,
  })),
  resetInnertube: jest.fn(),
  decodeEntities: jest.fn((str) => str || ''),
  selectBestLanguage: jest.fn((langs) => langs?.[0] || null),
  HIGH_CONFIDENCE_LANGUAGES: ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'sv', 'da', 'fi', 'no'],
}))

describe('Video Details API', () => {
  const API_KEY = process.env.YOUTUBE_API_KEY;
  let videoDetailsHandler;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()
    mockGetInfo.mockReset()
    mockFetchTranscript.mockReset()
    mockListTranscripts.mockReset()
    
    // Reset the module to clear the singleton instance
    jest.resetModules()
    
    // Re-import the handler fresh
    videoDetailsHandler = require('../video-details').default
  })

  it('returns 405 for non-POST requests', async () => {
    const { req, res } = createMocks({
      method: 'GET',
    })

    await videoDetailsHandler(req, res)
    expect(res._getStatusCode()).toBe(405)
  })

  it('returns 401 for invalid API key', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'api-key': 'invalid-key',
      },
      body: {
        id: 'video123',
      },
    })

    await videoDetailsHandler(req, res)
    expect(res._getStatusCode()).toBe(401)
  })

  it('returns 400 for missing video ID', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'api-key': API_KEY,
      },
      body: {},
    })

    await videoDetailsHandler(req, res)
    expect(res._getStatusCode()).toBe(400)
  })

  it('successfully fetches video details', async () => {
    const mockVideoInfo = {
      basic_info: {
        id: 'video123',
        title: 'Test Video',
        short_description: 'Test Description',
        duration: 600,
        view_count: 5000,
        like_count: 1000,
        is_live: false,
        has_captions: true,
        author: 'Test Channel',
        channel_id: 'channel123',
      },
      primary_info: {
        published: { text: '2023-01-01' },
      },
      secondary_info: {
        owner: {
          author: {
            id: 'channel123',
            name: 'Test Channel',
            thumbnails: [{ url: 'thumbnail.jpg' }],
            url: 'https://youtube.com/channel123',
          },
          subscriber_count: { text: '10K subscribers' },
        },
      },
      player_overlays: {},
      captions: {},
    }

    mockGetInfo.mockResolvedValueOnce(mockVideoInfo)
    
    // Mock transcript
    mockFetchTranscript.mockResolvedValueOnce([
      { text: 'Hello', offset: 0 },
      { text: 'World', offset: 1 },
    ])

    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'api-key': API_KEY,
      },
      body: {
        id: 'video123',
        transcript: true,
      },
    })

    await videoDetailsHandler(req, res)

    expect(res._getStatusCode()).toBe(200)
    const data = JSON.parse(res._getData())
    expect(data.id).toBe('video123')
    expect(data.title).toBe('Test Video')
    expect(data.viewCount).toBe(5000)
    expect(data.duration).toBe(600)
    expect(data.transcript).toContain('Hello')
    expect(data.transcript).toContain('World')
  })

  it('handles video not found', async () => {
    mockGetInfo.mockResolvedValueOnce(null)

    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'api-key': API_KEY,
      },
      body: {
        id: 'nonexistent',
      },
    })

    await videoDetailsHandler(req, res)
    expect(res._getStatusCode()).toBe(404)
  })

  it('handles video without transcript', async () => {
    const mockVideoInfo = {
      basic_info: {
        id: 'video456',
        title: 'No Transcript Video',
        short_description: 'Test Description',
        duration: 600,
        view_count: 5000,
        like_count: 1000,
        is_live: false,
        has_captions: false,
        author: 'Test Channel',
        channel_id: 'channel123',
      },
      primary_info: {},
      secondary_info: {},
      player_overlays: {},
    }

    mockGetInfo.mockResolvedValueOnce(mockVideoInfo)
    mockFetchTranscript.mockRejectedValueOnce(new Error('Transcript is disabled'))

    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'api-key': API_KEY,
      },
      body: {
        id: 'video456',
        transcript: true,
      },
    })

    await videoDetailsHandler(req, res)

    expect(res._getStatusCode()).toBe(200)
    const data = JSON.parse(res._getData())
    expect(data.id).toBe('video456')
    expect(data.transcript).toBeNull()
    expect(data.transcript_status.available).toBe(false)
  })
})
