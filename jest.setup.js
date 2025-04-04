import '@testing-library/jest-dom'

// Mock the youtubei module
jest.mock('@/utils/youtubei', () => ({
  __esModule: true,
  default: {
    search: jest.fn(),
    getVideo: jest.fn(),
    getChannel: jest.fn(),
    getPlaylist: jest.fn(),
    findOne: jest.fn(),
  },
})); 