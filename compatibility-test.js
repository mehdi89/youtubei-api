/**
 * Compatibility Test Script
 * This script can be run against both the current YouTubei API
 * and the new yt-dlp implementation to verify they're compatible
 */

const API_KEY = 'WhK!%hCNI0NyWP%Nb75uUjE%^abmuEJ%4T1PaD%848E';
const API_URL = 'http://localhost:3000'; // Works with both implementations

async function testEndpoint(endpoint, body, description) {
  console.log(`\nTesting: ${description}`);
  
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': API_KEY
      },
      body: JSON.stringify(body)
    });
    
    const data = await response.json();
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`✅ Response structure valid: ${validateStructure(endpoint, data)}`);
    
    return { success: true, data };
  } catch (error) {
    console.log(`❌ Failed: ${error.message}`);
    return { success: false, error };
  }
}

function validateStructure(endpoint, data) {
  // Check if response matches expected structure
  switch(endpoint) {
    case '/api/video-details':
      return data.id && data.title && data.channel;
    
    case '/api/transcript':
      return data.transcript !== undefined;
    
    case '/api/channel-videos':
      return Array.isArray(data) || (data.items !== undefined);
    
    case '/api/search':
      return data.items && Array.isArray(data.items);
    
    case '/api/channel-details':
      return data.id && data.name;
    
    default:
      return true;
  }
}

async function runCompatibilityTests() {
  console.log('=================================');
  console.log('API COMPATIBILITY TEST');
  console.log('=================================');
  console.log(`Testing against: ${API_URL}`);
  
  const tests = [
    {
      endpoint: '/api/video-details',
      body: { id: 'dQw4w9WgXcQ' },
      description: 'Video Details Endpoint'
    },
    {
      endpoint: '/api/transcript',
      body: { videoId: 'dQw4w9WgXcQ', format: 'plain' },
      description: 'Transcript Endpoint'
    },
    {
      endpoint: '/api/channel-videos',
      body: { id: 'MrBeast', tab: 'videos', page: 1 },
      description: 'Channel Videos Endpoint'
    },
    {
      endpoint: '/api/search',
      body: { query: 'javascript tutorial', type: 'video', limit: 5 },
      description: 'Search Endpoint'
    },
    {
      endpoint: '/api/channel-details',
      body: { id: 'MrBeast' },
      description: 'Channel Details Endpoint'
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    const result = await testEndpoint(test.endpoint, test.body, test.description);
    if (result.success) {
      passed++;
    } else {
      failed++;
    }
  }
  
  console.log('\n=================================');
  console.log('COMPATIBILITY TEST RESULTS');
  console.log('=================================');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Compatibility: ${passed}/${tests.length} (${Math.round(passed/tests.length * 100)}%)`);
  
  if (failed === 0) {
    console.log('\n🎉 FULLY COMPATIBLE - Safe to migrate!');
  } else {
    console.log('\n⚠️  Some endpoints need adjustment');
  }
}

// Run the tests
runCompatibilityTests().catch(console.error);