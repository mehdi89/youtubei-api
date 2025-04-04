import { createMocks } from 'node-mocks-http'
import searchHandler from '../search'
import youtubei from '@/utils/youtubei'

describe('Search API', () => {
  const API_KEY = 'S#D$FG%^$#DEF%G^*$%R^T&Y*U'

  beforeEach(() => {
    jest.clearAllMocks()
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

  it('successfully searches for videos', async () => {
    const mockSearchResults = {
      items: [
        {
          id: 'video1',
          title: 'Test Video',
          duration: '10:00',
          description: 'Test Description',
          isLive: false,
          viewCount: 1000,
          uploadDate: '2023-01-01',
          channel: {
            name: 'Test Channel',
            id: 'channel1',
            thumbnails: [{ url: 'thumbnail.jpg' }],
          },
        },
      ],
    }

    youtubei.search.mockResolvedValueOnce(mockSearchResults)

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
    expect(JSON.parse(res._getData())).toHaveLength(1)
    expect(youtubei.search).toHaveBeenCalledWith('test video', { type: 'video' })
  })

  it('returns 404 when no results found', async () => {
    youtubei.search.mockResolvedValueOnce({ items: [] })

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