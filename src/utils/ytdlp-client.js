/**
 * Node.js client for yt-dlp wrapper.
 * Provides a drop-in replacement for the youtubei library.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Execute Python wrapper and return parsed result
 * @param {Object} command - Command object with command name and params
 * @returns {Promise<any>} - Parsed response from Python wrapper
 */
async function executePythonWrapper(command) {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, 'ytdlp-wrapper.py');
    const commandJson = JSON.stringify(command);

    const python = spawn('python3', [pythonScript, commandJson]);

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python process exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        const result = JSON.parse(stdout);

        // Check for error in response
        if (result.error) {
          reject(new Error(result.error));
          return;
        }

        resolve(result);
      } catch (error) {
        reject(new Error(`Failed to parse Python response: ${error.message}\nOutput: ${stdout}`));
      }
    });

    python.on('error', (error) => {
      reject(new Error(`Failed to start Python process: ${error.message}`));
    });
  });
}

/**
 * Client class that mimics youtubei's Client interface
 */
class Client {
  constructor() {
    // No initialization needed for yt-dlp wrapper
  }

  /**
   * Get video details
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Object>} - Video details object
   */
  async getVideo(videoId) {
    try {
      const result = await executePythonWrapper({
        command: 'getVideo',
        params: {
          id: videoId,
          transcript: false, // Don't fetch transcript by default
          timestamped: false
        }
      });

      // Return video object with captions interface
      return {
        ...result,
        captions: {
          get: async () => {
            // Fetch transcript when requested
            const transcriptResult = await executePythonWrapper({
              command: 'getTranscript',
              params: {
                id: videoId,
                timestamped: false
              }
            });
            return transcriptResult.transcript || '';
          },
          languages: await this._getLanguages(videoId)
        }
      };
    } catch (error) {
      console.error('❌ ERROR Error fetching video:', error.message);
      return null;
    }
  }

  /**
   * Get available caption languages for a video
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Array>} - Array of language objects
   */
  async _getLanguages(videoId) {
    try {
      const languages = await executePythonWrapper({
        command: 'listLanguages',
        params: { id: videoId }
      });
      return languages;
    } catch (error) {
      console.error('⚠️ WARN Could not fetch languages:', error.message);
      return [];
    }
  }

  /**
   * Search YouTube
   * @param {string} query - Search query
   * @param {Object} options - Search options {type: 'video'|'channel'|'playlist'}
   * @returns {Promise<Object>} - Search results with next() method for pagination
   */
  async search(query, options = {}) {
    const searchType = options.type || 'video';

    try {
      const results = await executePythonWrapper({
        command: 'search',
        params: {
          query,
          type: searchType,
          page: 1
        }
      });

      // Return object with items and next() method for pagination
      return {
        items: results,
        currentPage: 1,
        query,
        searchType,
        next: async function() {
          this.currentPage++;
          const nextResults = await executePythonWrapper({
            command: 'search',
            params: {
              query: this.query,
              type: this.searchType,
              page: this.currentPage
            }
          });
          this.items = nextResults;
          return this;
        }
      };
    } catch (error) {
      console.error('❌ ERROR Error searching:', error.message);
      return { items: [] };
    }
  }

  /**
   * Find one item (channel or playlist)
   * @param {string} id - Channel or playlist ID
   * @param {Object} options - Options {type: 'channel'|'playlist'}
   * @returns {Promise<Object>} - Channel or playlist object
   */
  async findOne(id, options = {}) {
    const itemType = options.type || 'channel';

    try {
      if (itemType === 'channel') {
        const result = await executePythonWrapper({
          command: 'getChannelDetails',
          params: { id }
        });

        // Fetch first page of videos immediately for consistency with playlists
        const firstPageVideos = await executePythonWrapper({
          command: 'getChannelVideos',
          params: { id, page: 1 }
        });

        // Return channel object with videos interface
        return {
          ...result,
          videos: {
            items: firstPageVideos,
            currentPage: 1,
            channelId: id,
            next: async function(page = null) {
              // Handle page parameter - if provided, use it; otherwise increment
              if (page !== null) {
                this.currentPage = page;
              } else {
                this.currentPage++;
              }

              const videos = await executePythonWrapper({
                command: 'getChannelVideos',
                params: {
                  id: this.channelId,
                  page: this.currentPage
                }
              });
              this.items = videos;
              return videos;
            }
          },
          getLiveStreams: async function() {
            const liveVideos = await executePythonWrapper({
              command: 'getChannelLiveVideos',
              params: { id }
            });
            return liveVideos;
          }
        };
      } else if (itemType === 'playlist') {
        const videos = await executePythonWrapper({
          command: 'getPlaylistVideos',
          params: { id, page: 1 }
        });

        // Return playlist object with videos interface
        return {
          id,
          videos: {
            items: videos,
            currentPage: 1,
            playlistId: id,
            next: async function(page = null) {
              if (page !== null) {
                this.currentPage = page;
              } else {
                this.currentPage++;
              }

              const nextVideos = await executePythonWrapper({
                command: 'getPlaylistVideos',
                params: {
                  id: this.playlistId,
                  page: this.currentPage
                }
              });
              this.items = nextVideos;
              return nextVideos;
            }
          }
        };
      }

      return null;
    } catch (error) {
      console.error(`❌ ERROR Error finding ${itemType}:`, error.message);
      return null;
    }
  }
}

/**
 * YoutubeTranscript class that mimics youtube-transcript library
 */
class YoutubeTranscript {
  /**
   * Fetch transcript for a video
   * @param {string} videoId - YouTube video ID
   * @param {Object} options - Options {lang: 'en'}
   * @returns {Promise<Array>} - Array of transcript segments
   */
  static async fetchTranscript(videoId, options = {}) {
    try {
      const result = await executePythonWrapper({
        command: 'getTranscript',
        params: {
          id: videoId,
          timestamped: true,
          language: options.lang || 'en'
        }
      });

      // Return the timestamped transcript array from yt-dlp
      if (result.timestamped_transcript_array && Array.isArray(result.timestamped_transcript_array)) {
        return result.timestamped_transcript_array;
      }

      // If transcript is available but no array, return empty to avoid errors
      if (result.transcript_status && result.transcript_status.available === false) {
        throw new Error(result.transcript_status.reason || 'Transcript not available');
      }

      return [];
    } catch (error) {
      console.error('❌ ERROR Error fetching transcript:', error.message);
      throw error;
    }
  }

  /**
   * List available transcript languages
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Array>} - Array of language objects
   */
  static async listLanguages(videoId) {
    try {
      const languages = await executePythonWrapper({
        command: 'listLanguages',
        params: { id: videoId }
      });
      return languages;
    } catch (error) {
      console.error('❌ ERROR Error listing languages:', error.message);
      return [];
    }
  }
}

// Export the Client class as default (like youtubei)
export default Client;

// Export YoutubeTranscript separately
export { YoutubeTranscript };

// Export a singleton instance for convenience (like youtubei)
export const youtube = new Client();
