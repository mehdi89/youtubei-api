import { useState, useCallback } from 'react';
import Head from 'next/head';

const API_ENDPOINTS = {
  search: '/api/search',
  videoDetails: '/api/video-details',
  transcript: '/api/transcript',
  channelDetails: '/api/channel-details',
  channelVideos: '/api/channel-videos',
  channelLiveVideos: '/api/channel-live-videos',
  playlist: '/api/playlist',
  hello: '/api/hello',
};

const TABS = ['Search', 'Video Details', 'Channel Details', 'Playlist'];

export default function TestUI() {
  const [apiKey, setApiKey] = useState('');
  const [activeTab, setActiveTab] = useState('Search');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [rawResponse, setRawResponse] = useState(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('video');
  const [searchSort, setSearchSort] = useState('relevance');

  // Video state
  const [videoId, setVideoId] = useState('');
  const [includeTranscript, setIncludeTranscript] = useState(true);

  // Channel state
  const [channelId, setChannelId] = useState('');
  const [channelContentType, setChannelContentType] = useState('videos');

  // Playlist state
  const [playlistId, setPlaylistId] = useState('');
  const [includeMetadata, setIncludeMetadata] = useState(true);

  const makeApiCall = useCallback(async (endpoint, body = null, method = 'POST') => {
    if (!apiKey) {
      setError('Please enter your API key');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setRawResponse(null);

    try {
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey,
        },
      };

      if (body && method !== 'GET') {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(endpoint, options);
      const data = await response.json();

      setRawResponse(data);

      if (!response.ok) {
        setError(data.error || `HTTP ${response.status}`);
        return;
      }

      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  const handleSearch = () => {
    makeApiCall(API_ENDPOINTS.search, {
      query: searchQuery,
      type: searchType,
      sortBy: searchSort,
      page: 1,
    });
  };

  const handleVideoDetails = () => {
    makeApiCall(API_ENDPOINTS.videoDetails, {
      id: videoId,
      transcript: includeTranscript,
    });
  };

  const handleChannelDetails = () => {
    makeApiCall(API_ENDPOINTS.channelDetails, { id: channelId });
  };

  const handleChannelVideos = () => {
    makeApiCall(API_ENDPOINTS.channelVideos, {
      id: channelId,
      contentType: channelContentType,
      page: 1,
    });
  };

  const handlePlaylist = () => {
    makeApiCall(API_ENDPOINTS.playlist, {
      id: playlistId,
      includeMetadata,
      page: 1,
    });
  };

  const handleHealthCheck = () => {
    makeApiCall(API_ENDPOINTS.hello, null, 'GET');
  };

  return (
    <>
      <Head>
        <title>YouTube API Test UI</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={styles.container}>
        {/* Header */}
        <header style={styles.header}>
          <div style={styles.logo}>
            <svg viewBox="0 0 90 20" style={{ width: 90, height: 20 }}>
              <path fill="#FF0000" d="M27.9727 3.12324C27.6435 1.89323 26.6768 0.926623 25.4468 0.597366C23.2197 2.24288e-07 14.285 0 14.285 0C14.285 0 5.35042 2.24288e-07 3.12323 0.597366C1.89323 0.926623 0.926623 1.89323 0.597366 3.12324C2.24288e-07 5.35042 0 10 0 10C0 10 2.24288e-07 14.6496 0.597366 16.8768C0.926623 18.1068 1.89323 19.0734 3.12323 19.4026C5.35042 20 14.285 20 14.285 20C14.285 20 23.2197 20 25.4468 19.4026C26.6768 19.0734 27.6435 18.1068 27.9727 16.8768C28.5701 14.6496 28.5701 10 28.5701 10C28.5701 10 28.5677 5.35042 27.9727 3.12324Z"/>
              <path fill="white" d="M11.4253 14.2854L18.8477 10.0004L11.4253 5.71533V14.2854Z"/>
            </svg>
            <span style={styles.logoText}>API Test UI</span>
          </div>

          <div style={styles.apiKeyContainer}>
            <input
              type="password"
              placeholder="Enter API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              style={styles.apiKeyInput}
            />
            <button onClick={handleHealthCheck} style={styles.healthBtn}>
              Health Check
            </button>
          </div>
        </header>

        {/* Tabs */}
        <nav style={styles.tabs}>
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setResult(null);
                setError(null);
                setRawResponse(null);
              }}
              style={{
                ...styles.tab,
                ...(activeTab === tab ? styles.activeTab : {}),
              }}
            >
              {tab}
            </button>
          ))}
        </nav>

        <main style={styles.main}>
          {/* Search Tab */}
          {activeTab === 'Search' && (
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Search YouTube</h2>
              <div style={styles.searchForm}>
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  style={styles.searchInput}
                />
                <select
                  value={searchType}
                  onChange={(e) => setSearchType(e.target.value)}
                  style={styles.select}
                >
                  <option value="video">Videos</option>
                  <option value="channel">Channels</option>
                  <option value="playlist">Playlists</option>
                </select>
                <select
                  value={searchSort}
                  onChange={(e) => setSearchSort(e.target.value)}
                  style={styles.select}
                >
                  <option value="relevance">Relevance</option>
                  <option value="date">Upload Date</option>
                  <option value="views">View Count</option>
                  <option value="rating">Rating</option>
                </select>
                <button onClick={handleSearch} style={styles.button} disabled={loading}>
                  {loading ? 'Searching...' : 'Search'}
                </button>
              </div>
            </div>
          )}

          {/* Video Details Tab */}
          {activeTab === 'Video Details' && (
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Video Details</h2>
              <div style={styles.form}>
                <input
                  type="text"
                  placeholder="Video ID (e.g., dQw4w9WgXcQ)"
                  value={videoId}
                  onChange={(e) => setVideoId(e.target.value)}
                  style={styles.input}
                />
                <label style={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={includeTranscript}
                    onChange={(e) => setIncludeTranscript(e.target.checked)}
                  />
                  Include Transcript
                </label>
                <button onClick={handleVideoDetails} style={styles.button} disabled={loading}>
                  {loading ? 'Loading...' : 'Get Video Details'}
                </button>
              </div>
            </div>
          )}

          {/* Channel Details Tab */}
          {activeTab === 'Channel Details' && (
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Channel Details</h2>
              <div style={styles.form}>
                <input
                  type="text"
                  placeholder="Channel ID (e.g., UC-lHJZR3Gqxm24_Vd_AJ5Yw)"
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  style={styles.input}
                />
                <div style={styles.buttonGroup}>
                  <button onClick={handleChannelDetails} style={styles.button} disabled={loading}>
                    {loading ? 'Loading...' : 'Get Channel Info'}
                  </button>
                  <select
                    value={channelContentType}
                    onChange={(e) => setChannelContentType(e.target.value)}
                    style={styles.select}
                  >
                    <option value="videos">Videos</option>
                    <option value="shorts">Shorts</option>
                    <option value="live">Live</option>
                    <option value="all">All</option>
                  </select>
                  <button onClick={handleChannelVideos} style={styles.buttonSecondary} disabled={loading}>
                    Get Videos
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Playlist Tab */}
          {activeTab === 'Playlist' && (
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Playlist</h2>
              <div style={styles.form}>
                <input
                  type="text"
                  placeholder="Playlist ID (e.g., PLRqwX-V7Uu6ZF9C0YMKuns9sLDzK6zoiV)"
                  value={playlistId}
                  onChange={(e) => setPlaylistId(e.target.value)}
                  style={styles.input}
                />
                <label style={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={includeMetadata}
                    onChange={(e) => setIncludeMetadata(e.target.checked)}
                  />
                  Include Playlist Metadata
                </label>
                <button onClick={handlePlaylist} style={styles.button} disabled={loading}>
                  {loading ? 'Loading...' : 'Get Playlist'}
                </button>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div style={styles.error}>
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Results Display */}
          {result && (
            <div style={styles.resultsContainer}>
              {/* Visual Results */}
              <div style={styles.visualResults}>
                <h3 style={styles.resultsTitle}>Results</h3>
                <ResultsDisplay result={result} type={activeTab} searchType={searchType} />
              </div>

              {/* Raw JSON */}
              <div style={styles.rawJson}>
                <h3 style={styles.resultsTitle}>Raw JSON Response</h3>
                <pre style={styles.jsonPre}>
                  {JSON.stringify(rawResponse, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

// Results Display Component
function ResultsDisplay({ result, type, searchType }) {
  if (!result) return null;

  // Health check
  if (result.message && result.version) {
    return (
      <div style={styles.card}>
        <p><strong>Message:</strong> {result.message}</p>
        <p><strong>Version:</strong> {result.version}</p>
        <p><strong>Powered by:</strong> {result.powered_by}</p>
      </div>
    );
  }

  // Search results
  if (type === 'Search' && result.data) {
    return (
      <div style={styles.grid}>
        {result.data.map((item, index) => (
          <SearchResultCard key={item.id || index} item={item} type={searchType} />
        ))}
      </div>
    );
  }

  // Video details
  if (type === 'Video Details' && result.data) {
    const video = result.data;
    return (
      <div style={styles.videoDetails}>
        <div style={styles.videoPlayer}>
          <img
            src={`https://img.youtube.com/vi/${video.id}/maxresdefault.jpg`}
            alt={video.title}
            style={styles.thumbnail}
            onError={(e) => {
              e.target.src = `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`;
            }}
          />
        </div>
        <h2 style={styles.videoTitle}>{video.title}</h2>
        <div style={styles.videoMeta}>
          <span>{formatNumber(video.viewCount)} views</span>
          <span> | </span>
          <span>{formatNumber(video.likeCount)} likes</span>
          <span> | </span>
          <span>{video.uploadDate}</span>
        </div>
        <div style={styles.channelInfo}>
          <strong>{video.channel?.name}</strong>
          {video.channel?.subscriber_count && (
            <span style={styles.subCount}>{video.channel.subscriber_count}</span>
          )}
        </div>
        <p style={styles.description}>{video.description?.substring(0, 500)}...</p>

        {video.chapters && video.chapters.length > 0 && (
          <div style={styles.chapters}>
            <h4>Chapters ({video.chapters.length})</h4>
            <ul style={styles.chapterList}>
              {video.chapters.slice(0, 10).map((chapter, i) => (
                <li key={i}>{chapter.start_time} - {chapter.title}</li>
              ))}
            </ul>
          </div>
        )}

        {video.transcript && (
          <div style={styles.transcript}>
            <h4>Transcript ({video.transcript_status})</h4>
            <div style={styles.transcriptText}>
              {video.transcript.substring(0, 2000)}...
            </div>
          </div>
        )}
      </div>
    );
  }

  // Channel details
  if (type === 'Channel Details' && result.data) {
    const channel = result.data;

    // Check if it's channel videos (array)
    if (Array.isArray(channel)) {
      return (
        <div style={styles.grid}>
          {channel.map((video, index) => (
            <VideoCard key={video.id || index} video={video} />
          ))}
        </div>
      );
    }

    return (
      <div style={styles.channelDetails}>
        {channel.banner && (
          <img src={channel.banner} alt="Banner" style={styles.banner} />
        )}
        <div style={styles.channelHeader}>
          {channel.thumbnail && (
            <img src={channel.thumbnail} alt={channel.name} style={styles.avatar} />
          )}
          <div>
            <h2 style={styles.channelName}>
              {channel.name}
              {channel.isVerified && <span style={styles.verified}> ✓</span>}
            </h2>
            <p style={styles.handle}>{channel.handle}</p>
            <p style={styles.stats}>
              {formatNumber(channel.subscriberCount)} subscribers | {formatNumber(channel.videosCount)} videos
            </p>
          </div>
        </div>
        <p style={styles.description}>{channel.description?.substring(0, 500)}</p>
      </div>
    );
  }

  // Playlist
  if (type === 'Playlist') {
    const data = result.data;
    const videos = data.videos || data;
    const playlist = data.playlist;

    return (
      <div>
        {playlist && (
          <div style={styles.playlistHeader}>
            {playlist.thumbnail && (
              <img src={playlist.thumbnail} alt={playlist.title} style={styles.playlistThumb} />
            )}
            <div>
              <h2>{playlist.title}</h2>
              <p>{playlist.author}</p>
              <p>{playlist.videoCount} videos</p>
            </div>
          </div>
        )}
        <div style={styles.grid}>
          {(Array.isArray(videos) ? videos : []).map((video, index) => (
            <VideoCard key={video.id || index} video={video} showIndex={index + 1} />
          ))}
        </div>
      </div>
    );
  }

  return <pre>{JSON.stringify(result, null, 2)}</pre>;
}

// Search Result Card
function SearchResultCard({ item, type }) {
  if (type === 'video') {
    return <VideoCard video={item} />;
  }

  if (type === 'channel') {
    return (
      <div style={styles.card}>
        <img
          src={item.thumbnail || 'https://via.placeholder.com/88'}
          alt={item.name}
          style={styles.channelThumb}
        />
        <div style={styles.cardContent}>
          <h4 style={styles.cardTitle}>{item.name}</h4>
          <p style={styles.cardMeta}>
            {item.subscriber_count} | {item.video_count}
          </p>
          <p style={styles.cardDesc}>{item.description?.substring(0, 100)}</p>
        </div>
      </div>
    );
  }

  if (type === 'playlist') {
    return (
      <div style={styles.card}>
        <div style={styles.thumbContainer}>
          <img
            src={item.thumbnail || 'https://via.placeholder.com/320x180'}
            alt={item.title}
            style={styles.cardThumb}
          />
          <span style={styles.videoCount}>{item.video_count}</span>
        </div>
        <div style={styles.cardContent}>
          <h4 style={styles.cardTitle}>{item.title}</h4>
          <p style={styles.cardMeta}>{item.author}</p>
        </div>
      </div>
    );
  }

  return null;
}

// Video Card
function VideoCard({ video, showIndex }) {
  return (
    <div style={styles.videoCard}>
      <div style={styles.thumbContainer}>
        {showIndex && <span style={styles.videoIndex}>{showIndex}</span>}
        <img
          src={video.thumbnail || `https://img.youtube.com/vi/${video.id}/mqdefault.jpg`}
          alt={video.title}
          style={styles.cardThumb}
          onError={(e) => {
            e.target.src = 'https://via.placeholder.com/320x180?text=No+Thumbnail';
          }}
        />
        {video.duration && <span style={styles.duration}>{video.duration}</span>}
        {video.isLive && <span style={styles.liveBadge}>LIVE</span>}
        {video.isShort && <span style={styles.shortBadge}>SHORT</span>}
      </div>
      <div style={styles.cardContent}>
        <h4 style={styles.cardTitle}>{video.title}</h4>
        <p style={styles.cardMeta}>
          {video.channel?.name || video.author}
          {video.isVerified && <span style={styles.verified}> ✓</span>}
        </p>
        <p style={styles.cardMeta}>
          {video.view_count || video.viewCount} {video.published || video.uploadDate}
        </p>
      </div>
    </div>
  );
}

// Helper function
function formatNumber(num) {
  if (!num) return '0';
  if (typeof num === 'string') return num;
  if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

// Styles
const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0f0f0f',
    color: '#fff',
    fontFamily: 'Roboto, Arial, sans-serif',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 24px',
    backgroundColor: '#0f0f0f',
    borderBottom: '1px solid #303030',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  logoText: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#fff',
  },
  apiKeyContainer: {
    display: 'flex',
    gap: '8px',
  },
  apiKeyInput: {
    padding: '8px 12px',
    borderRadius: '4px',
    border: '1px solid #303030',
    backgroundColor: '#121212',
    color: '#fff',
    width: '200px',
  },
  healthBtn: {
    padding: '8px 16px',
    backgroundColor: '#3ea6ff',
    color: '#0f0f0f',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '500',
  },
  tabs: {
    display: 'flex',
    gap: '4px',
    padding: '12px 24px',
    backgroundColor: '#0f0f0f',
    borderBottom: '1px solid #303030',
  },
  tab: {
    padding: '10px 20px',
    backgroundColor: 'transparent',
    color: '#aaa',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
  activeTab: {
    backgroundColor: '#272727',
    color: '#fff',
  },
  main: {
    padding: '24px',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  section: {
    marginBottom: '24px',
  },
  sectionTitle: {
    fontSize: '20px',
    fontWeight: '500',
    marginBottom: '16px',
  },
  searchForm: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  searchInput: {
    flex: '1',
    minWidth: '300px',
    padding: '12px 16px',
    borderRadius: '40px',
    border: '1px solid #303030',
    backgroundColor: '#121212',
    color: '#fff',
    fontSize: '16px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    maxWidth: '600px',
  },
  input: {
    padding: '12px 16px',
    borderRadius: '4px',
    border: '1px solid #303030',
    backgroundColor: '#121212',
    color: '#fff',
    fontSize: '14px',
  },
  select: {
    padding: '12px 16px',
    borderRadius: '4px',
    border: '1px solid #303030',
    backgroundColor: '#121212',
    color: '#fff',
    fontSize: '14px',
    cursor: 'pointer',
  },
  button: {
    padding: '12px 24px',
    backgroundColor: '#3ea6ff',
    color: '#0f0f0f',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
  buttonSecondary: {
    padding: '12px 24px',
    backgroundColor: '#272727',
    color: '#fff',
    border: '1px solid #303030',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
  buttonGroup: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#aaa',
  },
  error: {
    padding: '16px',
    backgroundColor: '#4a1515',
    borderRadius: '4px',
    color: '#ff6b6b',
    marginBottom: '24px',
  },
  resultsContainer: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '24px',
  },
  visualResults: {
    backgroundColor: '#181818',
    borderRadius: '8px',
    padding: '16px',
    overflow: 'auto',
    maxHeight: '800px',
  },
  rawJson: {
    backgroundColor: '#181818',
    borderRadius: '8px',
    padding: '16px',
    overflow: 'auto',
    maxHeight: '800px',
  },
  resultsTitle: {
    fontSize: '16px',
    fontWeight: '500',
    marginBottom: '16px',
    color: '#aaa',
  },
  jsonPre: {
    margin: 0,
    fontSize: '12px',
    color: '#8ab4f8',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '16px',
  },
  card: {
    backgroundColor: '#212121',
    borderRadius: '8px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  videoCard: {
    backgroundColor: 'transparent',
  },
  thumbContainer: {
    position: 'relative',
    aspectRatio: '16/9',
    backgroundColor: '#303030',
  },
  cardThumb: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: '8px',
  },
  duration: {
    position: 'absolute',
    bottom: '4px',
    right: '4px',
    backgroundColor: 'rgba(0,0,0,0.8)',
    color: '#fff',
    padding: '2px 4px',
    borderRadius: '2px',
    fontSize: '12px',
    fontWeight: '500',
  },
  liveBadge: {
    position: 'absolute',
    bottom: '4px',
    right: '4px',
    backgroundColor: '#ff0000',
    color: '#fff',
    padding: '2px 4px',
    borderRadius: '2px',
    fontSize: '11px',
    fontWeight: '500',
  },
  shortBadge: {
    position: 'absolute',
    bottom: '4px',
    left: '4px',
    backgroundColor: '#ff0000',
    color: '#fff',
    padding: '2px 4px',
    borderRadius: '2px',
    fontSize: '11px',
    fontWeight: '500',
  },
  videoIndex: {
    position: 'absolute',
    top: '4px',
    left: '4px',
    backgroundColor: 'rgba(0,0,0,0.8)',
    color: '#fff',
    padding: '2px 6px',
    borderRadius: '2px',
    fontSize: '12px',
    fontWeight: '500',
  },
  videoCount: {
    position: 'absolute',
    bottom: '4px',
    right: '4px',
    backgroundColor: 'rgba(0,0,0,0.8)',
    color: '#fff',
    padding: '2px 8px',
    borderRadius: '2px',
    fontSize: '12px',
  },
  cardContent: {
    padding: '12px 0',
  },
  cardTitle: {
    fontSize: '14px',
    fontWeight: '500',
    margin: '0 0 4px 0',
    color: '#fff',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  cardMeta: {
    fontSize: '12px',
    color: '#aaa',
    margin: '2px 0',
  },
  cardDesc: {
    fontSize: '12px',
    color: '#aaa',
    marginTop: '8px',
  },
  channelThumb: {
    width: '88px',
    height: '88px',
    borderRadius: '50%',
    objectFit: 'cover',
    margin: '16px',
  },
  videoDetails: {
    maxWidth: '800px',
  },
  videoPlayer: {
    aspectRatio: '16/9',
    backgroundColor: '#000',
    borderRadius: '8px',
    overflow: 'hidden',
    marginBottom: '16px',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  videoTitle: {
    fontSize: '20px',
    fontWeight: '500',
    margin: '0 0 8px 0',
  },
  videoMeta: {
    color: '#aaa',
    fontSize: '14px',
    marginBottom: '16px',
  },
  channelInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
    padding: '12px 0',
    borderBottom: '1px solid #303030',
  },
  subCount: {
    color: '#aaa',
    fontSize: '14px',
  },
  description: {
    color: '#aaa',
    fontSize: '14px',
    lineHeight: '1.6',
    marginBottom: '16px',
  },
  chapters: {
    marginTop: '16px',
    padding: '16px',
    backgroundColor: '#212121',
    borderRadius: '8px',
  },
  chapterList: {
    listStyle: 'none',
    padding: 0,
    margin: '8px 0 0 0',
    fontSize: '14px',
    color: '#aaa',
  },
  transcript: {
    marginTop: '16px',
    padding: '16px',
    backgroundColor: '#212121',
    borderRadius: '8px',
  },
  transcriptText: {
    fontSize: '14px',
    color: '#aaa',
    lineHeight: '1.8',
    maxHeight: '300px',
    overflow: 'auto',
    whiteSpace: 'pre-wrap',
  },
  channelDetails: {
    maxWidth: '800px',
  },
  banner: {
    width: '100%',
    height: '150px',
    objectFit: 'cover',
    borderRadius: '8px',
    marginBottom: '16px',
  },
  channelHeader: {
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
    marginBottom: '16px',
  },
  avatar: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    objectFit: 'cover',
  },
  channelName: {
    fontSize: '24px',
    fontWeight: '500',
    margin: '0 0 4px 0',
  },
  handle: {
    color: '#aaa',
    fontSize: '14px',
    margin: '0 0 4px 0',
  },
  stats: {
    color: '#aaa',
    fontSize: '14px',
    margin: 0,
  },
  verified: {
    color: '#aaa',
    fontSize: '14px',
  },
  playlistHeader: {
    display: 'flex',
    gap: '16px',
    marginBottom: '24px',
    padding: '16px',
    backgroundColor: '#212121',
    borderRadius: '8px',
  },
  playlistThumb: {
    width: '200px',
    height: '112px',
    objectFit: 'cover',
    borderRadius: '4px',
  },
};
