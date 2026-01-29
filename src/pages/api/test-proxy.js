// Proxy API for Test UI - adds API key internally so it's not exposed to the client
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { endpoint, body, method = 'POST' } = req.body;

  // Allowed endpoints for the proxy
  const allowedEndpoints = [
    '/api/search',
    '/api/video-details',
    '/api/transcript',
    '/api/channel-details',
    '/api/channel-videos',
    '/api/channel-live-videos',
    '/api/playlist',
    '/api/hello',
  ];

  if (!allowedEndpoints.includes(endpoint)) {
    return res.status(400).json({ error: 'Invalid endpoint' });
  }

  try {
    // Build the full URL for the internal API
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host;
    const url = `${protocol}://${host}${endpoint}`;

    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.YOUTUBE_API_KEY,
      },
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json();

    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ error: 'Proxy request failed' });
  }
}
