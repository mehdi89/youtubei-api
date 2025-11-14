const axios = require('axios');

const ORIGINAL_API = 'http://localhost:3000/api';
const YTDLP_API = 'http://localhost:3001/api';
const API_KEY = 'WhK!%hCNI0NyWP%Nb75uUjE%^abmuEJ%4T1PaD%848E';

async function testEndpoint(name, endpoint, payload, originalApi = ORIGINAL_API, ytdlpApi = YTDLP_API) {
  console.log(`\n📊 Testing ${name}...`);
  
  try {
    // Test original API
    const originalResponse = await axios.post(`${originalApi}${endpoint}`, payload, {
      headers: { 'api-key': API_KEY }
    });
    console.log(`✅ Original API returned ${originalResponse.data.items?.length || 1} items`);
    
    // Test yt-dlp API
    const ytdlpResponse = await axios.post(`${ytdlpApi}${endpoint}`, payload, {
      headers: { 'api-key': API_KEY }
    });
    console.log(`✅ yt-dlp API returned ${ytdlpResponse.data.items?.length || 1} items`);
    
    // Compare response structures
    const originalKeys = Object.keys(originalResponse.data).sort();
    const ytdlpKeys = Object.keys(ytdlpResponse.data).sort();
    
    if (JSON.stringify(originalKeys) === JSON.stringify(ytdlpKeys)) {
      console.log(`✅ Response structure matches`);
    } else {
      console.log(`⚠️  Different keys - Original: ${originalKeys}, yt-dlp: ${ytdlpKeys}`);
    }
    
    return { success: true, original: originalResponse.data, ytdlp: ytdlpResponse.data };
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🚀 Starting App Compatibility Tests');
  console.log('================================');
  
  // Test search with app's format
  await testEndpoint('Search (App Format)', '/search', {
    page: 1,
    q: 'javascript tutorial',
    source: null,
    status: null,
    sort_by: null,
    sort_order: null
  });
  
  // Test search with original format (should still work)
  await testEndpoint('Search (Original Format)', '/search', {
    type: 'video',
    query: 'python tutorial',
    page: 1
  });
  
  // Test video details
  await testEndpoint('Video Details', '/video-details', {
    videoId: 'dQw4w9WgXcQ'
  });
  
  // Test transcript
  await testEndpoint('Transcript', '/transcript', {
    videoId: 'dQw4w9WgXcQ',
    format: 'timestamped'
  });
  
  // Test channel videos with pagination
  await testEndpoint('Channel Videos', '/channel-videos', {
    channelId: 'UCsBjURrPoezykLs9EqgamOA',
    page: 1
  });
  
  // Test playlist
  await testEndpoint('Playlist', '/playlist', {
    playlistId: 'PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf',
    page: 1
  });
  
  console.log('\n✨ Compatibility tests complete!');
}

runTests().catch(console.error);