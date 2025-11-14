import { createMocks } from 'node-mocks-http'
import channelVideosHandler from '../channel-videos'
import youtubei from '@/utils/youtubei'

describe('Channel Videos API', () => {
  const API_KEY = process.env.YOUTUBE_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 405 for non-POST requests', async () => {
    const { req, res } = createMocks({
      method: 'GET',
    })

    await channelVideosHandler(req, res)
    expect(res._getStatusCode()).toBe(405)
  })

  it('returns 401 for invalid API key', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'api-key': 'invalid-key',
      },
      body: {
        id: 'channel123',
      },
    })

    await channelVideosHandler(req, res)
    expect(res._getStatusCode()).toBe(401)
  })

  it('returns 400 for missing channel ID', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'api-key': API_KEY,
      },
      body: {},
    })

    await channelVideosHandler(req, res)
    expect(res._getStatusCode()).toBe(400)
    expect(res._getJSONData()).toEqual({ message: 'Channel ID is required' })
  })

  it('returns 400 for invalid tab parameter', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'api-key': API_KEY,
      },
      body: {
        id: 'channel123',
        tab: 'invalid',
      },
    })

    await channelVideosHandler(req, res)
    expect(res._getStatusCode()).toBe(400)
    expect(res._getJSONData()).toEqual({ 
      message: 'Invalid tab parameter. Must be one of: videos, shorts, streams, playlists' 
    })
  })

  it('defaults to videos tab when tab is not specified', async () => {
    const mockChannel = {
      videos: {
        items: [],
        next: jest.fn().mockResolvedValue([]),
      },
      shorts: {
        items: [],
        next: jest.fn().mockResolvedValue([]),
      },
      live: {
        items: [],
        next: jest.fn().mockResolvedValue([]),
      },
      playlists: {
        items: [],
        next: jest.fn().mockResolvedValue([]),
      },
    }

    jest.spyOn(youtubei, 'findOne').mockResolvedValue(mockChannel)

    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'api-key': API_KEY,
      },
      body: {
        id: 'channel123',
      },
    })

    await channelVideosHandler(req, res)
    expect(res._getStatusCode()).toBe(200)
    expect(mockChannel.videos.next).toHaveBeenCalled()
  })

  it('uses videos tab when specified', async () => {
    const mockChannel = {
      videos: {
        items: [],
        next: jest.fn().mockResolvedValue([]),
      },
      shorts: {
        items: [],
        next: jest.fn().mockResolvedValue([]),
      },
      live: {
        items: [],
        next: jest.fn().mockResolvedValue([]),
      },
      playlists: {
        items: [],
        next: jest.fn().mockResolvedValue([]),
      },
    }

    jest.spyOn(youtubei, 'findOne').mockResolvedValue(mockChannel)

    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'api-key': API_KEY,
      },
      body: {
        id: 'channel123',
        tab: 'videos',
      },
    })

    await channelVideosHandler(req, res)
    expect(res._getStatusCode()).toBe(200)
    expect(mockChannel.videos.next).toHaveBeenCalled()
  })

  it('returns notice for shorts tab due to library limitation', async () => {
    const mockChannel = {
      videos: {
        items: [],
        next: jest.fn().mockResolvedValue([]),
      },
      shorts: {
        items: [],
        next: jest.fn().mockResolvedValue([]),
      },
      live: {
        items: [],
        next: jest.fn().mockResolvedValue([]),
      },
      playlists: {
        items: [],
        next: jest.fn().mockResolvedValue([]),
      },
    }

    jest.spyOn(youtubei, 'findOne').mockResolvedValue(mockChannel)

    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'api-key': API_KEY,
      },
      body: {
        id: 'channel123',
        tab: 'shorts',
      },
    })

    await channelVideosHandler(req, res)
    expect(res._getStatusCode()).toBe(200)
    const data = res._getJSONData()
    expect(data).toHaveProperty('items')
    expect(data).toHaveProperty('notice')
    expect(data.items).toEqual([])
    expect(data.notice).toContain('known issue in the youtubei library')
  })

  it('uses live tab for streams', async () => {
    const mockChannel = {
      videos: {
        items: [],
        next: jest.fn().mockResolvedValue([]),
      },
      shorts: {
        items: [],
        next: jest.fn().mockResolvedValue([]),
      },
      live: {
        items: [],
        next: jest.fn().mockResolvedValue([]),
      },
      playlists: {
        items: [],
        next: jest.fn().mockResolvedValue([]),
      },
    }

    jest.spyOn(youtubei, 'findOne').mockResolvedValue(mockChannel)

    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'api-key': API_KEY,
      },
      body: {
        id: 'channel123',
        tab: 'streams',
      },
    })

    await channelVideosHandler(req, res)
    expect(res._getStatusCode()).toBe(200)
    expect(mockChannel.live.next).toHaveBeenCalled()
  })

  it('uses playlists tab when specified', async () => {
    const mockChannel = {
      videos: {
        items: [],
        next: jest.fn().mockResolvedValue([]),
      },
      shorts: {
        items: [],
        next: jest.fn().mockResolvedValue([]),
      },
      live: {
        items: [],
        next: jest.fn().mockResolvedValue([]),
      },
      playlists: {
        items: [],
        next: jest.fn().mockResolvedValue([]),
      },
    }

    jest.spyOn(youtubei, 'findOne').mockResolvedValue(mockChannel)

    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'api-key': API_KEY,
      },
      body: {
        id: 'channel123',
        tab: 'playlists',
      },
    })

    await channelVideosHandler(req, res)
    expect(res._getStatusCode()).toBe(200)
    expect(mockChannel.playlists.next).toHaveBeenCalled()
  })

  it('returns 404 when channel is not found', async () => {
    jest.spyOn(youtubei, 'findOne').mockResolvedValue(null)

    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'api-key': API_KEY,
      },
      body: {
        id: 'nonexistent',
      },
    })

    await channelVideosHandler(req, res)
    expect(res._getStatusCode()).toBe(404)
    expect(res._getJSONData()).toEqual({ message: 'Channel not found' })
  })

  it('returns formatted playlist data for playlists tab', async () => {
    const mockPlaylist = {
      id: 'playlist123',
      title: 'Test Playlist',
      videoCount: '10',
      thumbnails: [{ url: 'https://example.com/thumbnail.jpg' }],
      channel: {
        name: 'Test Channel',
        id: 'channel123',
      },
    }

    const mockChannel = {
      videos: {
        items: [],
        next: jest.fn().mockResolvedValue([]),
      },
      shorts: {
        items: [],
        next: jest.fn().mockResolvedValue([]),
      },
      live: {
        items: [],
        next: jest.fn().mockResolvedValue([]),
      },
      playlists: {
        items: [],
        next: jest.fn().mockResolvedValue([mockPlaylist]),
      },
    }

    jest.spyOn(youtubei, 'findOne').mockResolvedValue(mockChannel)

    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'api-key': API_KEY,
      },
      body: {
        id: 'channel123',
        tab: 'playlists',
      },
    })

    await channelVideosHandler(req, res)
    expect(res._getStatusCode()).toBe(200)
    const data = res._getJSONData()
    expect(data).toHaveLength(1)
    expect(data[0]).toEqual({
      id: 'playlist123',
      title: 'Test Playlist',
      videoCount: '10',
      thumbnail: 'https://example.com/thumbnail.jpg',
      channelName: 'Test Channel',
      channelID: 'channel123',
    })
  })

  it('returns formatted video data for video tabs', async () => {
    const mockVideo = {
      id: 'video123',
      title: 'Test Video',
      duration: '10:30',
      description: 'Test description',
      isLive: false,
      viewCount: '1000',
      uploadDate: '2023-01-01',
      channel: {
        name: 'Test Channel',
        id: 'channel123',
      },
    }

    const mockChannel = {
      videos: {
        items: [],
        next: jest.fn().mockResolvedValue([mockVideo]),
      },
      shorts: {
        items: [],
        next: jest.fn().mockResolvedValue([]),
      },
      live: {
        items: [],
        next: jest.fn().mockResolvedValue([]),
      },
      playlists: {
        items: [],
        next: jest.fn().mockResolvedValue([]),
      },
    }

    jest.spyOn(youtubei, 'findOne').mockResolvedValue(mockChannel)

    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'api-key': API_KEY,
      },
      body: {
        id: 'channel123',
        tab: 'videos',
      },
    })

    await channelVideosHandler(req, res)
    expect(res._getStatusCode()).toBe(200)
    const data = res._getJSONData()
    expect(data).toHaveLength(1)
    expect(data[0]).toEqual({
      id: 'video123',
      title: 'Test Video',
      duration: '10:30',
      description: 'Test description',
      isLive: false,
      viewCount: '1000',
      uploadDate: '2023-01-01',
      thumbnail: 'https://img.youtube.com/vi/video123/hqdefault.jpg',
      channelName: 'Test Channel',
      channelID: 'channel123',
    })
  })
})