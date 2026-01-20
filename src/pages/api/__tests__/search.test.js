import { createMocks } from 'node-mocks-http'

// Create mock functions at module level
const mockSearch = jest.fn()

// Mock the shared innertube utility
jest.mock('@/utils/innertube', () => ({
  getInnertube: jest.fn().mockImplementation(() => Promise.resolve({
    search: mockSearch,
  })),
  resetInnertube: jest.fn(),
  decodeEntities: jest.fn((str) => str || ''),
  selectBestLanguage: jest.fn((langs) => langs?.[0] || null),
  HIGH_CONFIDENCE_LANGUAGES: ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'sv', 'da', 'fi', 'no'],
}))

describe('Search API', () => {
  const API_KEY = process.env.YOUTUBE_API_KEY;
  let searchHandler;

  beforeEach(() => {
    jest.clearAllMocks()
    mockSearch.mockReset()
    jest.resetModules()
    searchHandler = require('../search').default
  })

  it('returns 405 for non-POST requests', async () => {
    const { req, res } = createMocks({
      method: 'GET',
    })

    await searchHandler(req, res)
    expect(res._getStatusCode()).toBe(405)
  })

  it('returns 401 for invalid API key', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'api-key': 'invalid-key',
      },
      body: {
        type: 'video',
        query: 'test',
      },
    })

    await searchHandler(req, res)
    expect(res._getStatusCode()).toBe(401)
  })

  it('returns 400 for missing query', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'api-key': API_KEY,
      },
      body: {
        type: 'video',
      },
    })

    await searchHandler(req, res)
    expect(res._getStatusCode()).toBe(400)
  })

  it('returns 400 for invalid search type', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'api-key': API_KEY,
      },
      body: {
        query: 'test',
        type: 'invalid',
      },
    })

    await searchHandler(req, res)
    expect(res._getStatusCode()).toBe(400)
  })

  it('successfully searches for videos', async () => {
    const mockSearchResults = {
      results: [
        {
          type: 'Video',
          id: 'video1',
          title: { text: 'Test Video' },
          duration: { text: '10:00' },
          description_snippet: { text: 'Test Description' },
          is_live: false,
          view_count: { text: '1,000 views' },
          published: { text: '1 day ago' },
          author: {
            name: 'Test Channel',
            id: 'channel1',
            thumbnails: [{ url: 'thumbnail.jpg' }],
          },
        },
      ],
      has_continuation: false,
    }

    mockSearch.mockResolvedValueOnce(mockSearchResults)

    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'api-key': API_KEY,
      },
      body: {
        type: 'video',
        query: 'test video',
      },
    })

    await searchHandler(req, res)

    expect(res._getStatusCode()).toBe(200)
    const data = JSON.parse(res._getData())
    expect(data).toHaveLength(1)
    expect(data[0].id).toBe('video1')
    expect(data[0].title).toBe('Test Video')
  })

  it('returns 404 when no results found', async () => {
    mockSearch.mockResolvedValueOnce({ results: [] })

    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'api-key': API_KEY,
      },
      body: {
        type: 'video',
        query: 'nonexistent',
      },
    })

    await searchHandler(req, res)
    expect(res._getStatusCode()).toBe(404)
  })
})
