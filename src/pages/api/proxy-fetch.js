import logger from "@/utils/logger";

const API_KEY = process.env.YOUTUBE_API_KEY;
const PROXY_SECRET = process.env.PROXY_SECRET;

const ALLOWED_HOSTS = ['youtube.com', 'www.youtube.com', 'googlevideo.com', 'www.googlevideo.com'];

function isAllowedUrl(url) {
  try {
    const parsed = new URL(url);
    return ALLOWED_HOSTS.some(host => parsed.hostname === host || parsed.hostname.endsWith('.' + host));
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Auth: accept either api-key header or secret in body
  const apiKey = req.headers['api-key'];
  const { url, headers: fetchHeaders, secret } = req.body;

  const authenticated = (apiKey && apiKey === API_KEY) || (secret && PROXY_SECRET && secret === PROXY_SECRET);
  if (!authenticated) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (!url || !isAllowedUrl(url)) {
    return res.status(400).json({ message: 'Invalid or disallowed URL' });
  }

  try {
    logger.info('Proxy fetch', `URL: ${url.substring(0, 80)}...`);
    const response = await fetch(url, {
      headers: fetchHeaders || {}
    });
    const body = await response.text();
    const contentType = response.headers.get('content-type') || 'text/plain';

    res.status(200).json({
      status: response.status,
      body,
      contentType
    });
  } catch (error) {
    logger.error('Proxy fetch failed', error.message);
    res.status(502).json({ message: 'Proxy fetch failed', error: error.message });
  }
}
