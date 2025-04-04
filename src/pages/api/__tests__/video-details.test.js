import { createMocks } from 'node-mocks-http'
import videoDetailsHandler from '../video-details'
import youtubei from '@/utils/youtubei'

describe('Video Details API', () => {
  const API_KEY = process.env.YOUTUBE_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks()
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
    const mockVideo = {
      id: 'video123',
      title: 'Test Video',
      description: 'Test Description',
      duration: '10:00',
      likeCount: 1000,
      isLiveContent: false,
      uploadDate: '2023-01-01',
      viewCount: 5000,
      channel: {
        id: 'channel123',
        name: 'Test Channel',
        subscriberCount: 10000,
        thumbnails: [{ url: 'thumbnail.jpg' }],
        videoCount: 100,
        url: 'https://youtube.com/channel123',
      },
      captions: {
        get: jest.fn().mockResolvedValue('Test transcript'),
      },
    }

    youtubei.getVideo.mockResolvedValueOnce(mockVideo)

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
    expect(data.transcript).toBe('Test transcript')
    expect(youtubei.getVideo).toHaveBeenCalledWith('video123')
  })

  it('handles video not found', async () => {
    youtubei.getVideo.mockResolvedValueOnce(null)

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
}) 