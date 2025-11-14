/**
 * YouTube client using yt-dlp wrapper
 * This is a drop-in replacement for the youtubei library
 */
import Client from './ytdlp-client.js';

// Create client instance
// Note: yt-dlp doesn't need axios configuration like youtubei did
// The Python wrapper handles all HTTP requests with proper headers
const youtubei = new Client();

// Export the youtube client
export default youtubei;
