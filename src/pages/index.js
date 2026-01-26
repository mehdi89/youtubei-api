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
  const [showRawData, setShowRawData] = useState(false);

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
            <div style={styles.resultsSection}>
              {/* Toggle Button */}
              <div style={styles.resultsHeader}>
                <h3 style={styles.resultsTitle}>
                  Results {result.data && Array.isArray(result.data) ? `(${result.data.length} items)` : ''}
                </h3>
                <button
                  onClick={() => setShowRawData(!showRawData)}
                  style={styles.toggleBtn}
                >
                  {showRawData ? 'Hide Raw JSON' : 'Show Raw JSON'}
                </button>
              </div>

              {/* Raw JSON Panel */}
              {showRawData && (
                <div style={styles.rawJson}>
                  <pre style={styles.jsonPre}>
                    {JSON.stringify(rawResponse, null, 2)}
                  </pre>
                </div>
              )}

              {/* Visual Results */}
              <div style={styles.visualResults}>
                <ResultsDisplay result={result} type={activeTab} searchType={searchType} />
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
      <div style={styles.healthCard}>
        <div style={styles.healthIcon}>&#10003;</div>
        <h3 style={styles.healthTitle}>API is Running</h3>
        <p style={styles.healthText}>{result.message}</p>
        <div style={styles.healthMeta}>
          <span>Version: {result.version}</span>
          <span>Powered by: {result.powered_by}</span>
        </div>
      </div>
    );
  }

  // Search results
  if (type === 'Search' && result.data) {
    if (result.data.length === 0) {
      return <div style={styles.noResults}>No results found</div>;
    }

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
      <div style={styles.videoDetailsContainer}>
        <div style={styles.videoMain}>
          {/* Video Player Area */}
          <div style={styles.videoPlayer}>
            <a
              href={`https://www.youtube.com/watch?v=${video.id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.videoLink}
            >
              <img
                src={`https://img.youtube.com/vi/${video.id}/maxresdefault.jpg`}
                alt={video.title}
                style={styles.videoThumbnail}
                onError={(e) => {
                  e.target.src = `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`;
                }}
              />
              <div style={styles.playButton}>
                <svg width="68" height="48" viewBox="0 0 68 48">
                  <path fill="#212121" fillOpacity="0.8" d="M66.52,7.74c-0.78-2.93-2.49-5.41-5.42-6.19C55.79,.13,34,0,34,0S12.21,.13,6.9,1.55 C3.97,2.33,2.27,4.81,1.48,7.74C0.06,13.05,0,24,0,24s0.06,10.95,1.48,16.26c0.78,2.93,2.49,5.41,5.42,6.19 C12.21,47.87,34,48,34,48s21.79-0.13,27.1-1.55c2.93-0.78,4.64-3.26,5.42-6.19C67.94,34.95,68,24,68,24S67.94,13.05,66.52,7.74z"/>
                  <path fill="#fff" d="M 45,24 27,14 27,34"/>
                </svg>
              </div>
            </a>
          </div>

          {/* Video Info */}
          <h1 style={styles.videoTitle}>{video.title}</h1>

          <div style={styles.videoStats}>
            <div style={styles.statItem}>
              <span style={styles.statValue}>{formatNumber(video.viewCount)}</span>
              <span style={styles.statLabel}>views</span>
            </div>
            <div style={styles.statItem}>
              <span style={styles.statValue}>{formatNumber(video.likeCount)}</span>
              <span style={styles.statLabel}>likes</span>
            </div>
            <div style={styles.statItem}>
              <span style={styles.statValue}>{video.duration}</span>
              <span style={styles.statLabel}>duration</span>
            </div>
            <div style={styles.statItem}>
              <span style={styles.statValue}>{video.uploadDate}</span>
              <span style={styles.statLabel}>uploaded</span>
            </div>
            {video.isLiveContent && (
              <div style={styles.liveBadgeLarge}>LIVE</div>
            )}
          </div>

          {/* Channel Info */}
          <div style={styles.channelRow}>
            <div style={styles.channelAvatar}>
              {video.channel?.name?.charAt(0) || 'C'}
            </div>
            <div style={styles.channelMeta}>
              <h3 style={styles.channelNameLink}>{video.channel?.name}</h3>
              {video.channel?.subscriber_count && (
                <span style={styles.channelSubs}>{video.channel.subscriber_count} subscribers</span>
              )}
            </div>
          </div>

          {/* Description */}
          <div style={styles.descriptionBox}>
            <h4 style={styles.sectionHeader}>Description</h4>
            <p style={styles.descriptionText}>
              {video.description || 'No description available'}
            </p>
          </div>

          {/* Chapters */}
          {video.chapters && video.chapters.length > 0 && (
            <div style={styles.chaptersBox}>
              <h4 style={styles.sectionHeader}>Chapters ({video.chapters.length})</h4>
              <div style={styles.chaptersList}>
                {video.chapters.map((chapter, i) => (
                  <div key={i} style={styles.chapterItem}>
                    <span style={styles.chapterTime}>{chapter.start_time}</span>
                    <span style={styles.chapterTitle}>{chapter.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transcript */}
          {video.transcript && (
            <div style={styles.transcriptBox}>
              <h4 style={styles.sectionHeader}>
                Transcript
                <span style={styles.transcriptStatus}>({video.transcript_status})</span>
              </h4>
              <div style={styles.transcriptContent}>
                {video.transcript}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Channel details
  if (type === 'Channel Details' && result.data) {
    const channel = result.data;

    // Check if it's channel videos (array)
    if (Array.isArray(channel)) {
      if (channel.length === 0) {
        return <div style={styles.noResults}>No videos found</div>;
      }
      return (
        <div style={styles.grid}>
          {channel.map((video, index) => (
            <VideoCard key={video.id || index} video={video} />
          ))}
        </div>
      );
    }

    return (
      <div style={styles.channelPage}>
        {/* Banner */}
        {channel.banner && (
          <div style={styles.channelBanner}>
            <img src={channel.banner} alt="Channel Banner" style={styles.bannerImg} />
          </div>
        )}

        {/* Channel Header */}
        <div style={styles.channelPageHeader}>
          <div style={styles.channelAvatarLarge}>
            {channel.thumbnail ? (
              <img src={channel.thumbnail} alt={channel.name} style={styles.avatarImg} />
            ) : (
              <span>{channel.name?.charAt(0) || 'C'}</span>
            )}
          </div>
          <div style={styles.channelPageInfo}>
            <h1 style={styles.channelPageName}>
              {channel.name}
              {channel.isVerified && (
                <span style={styles.verifiedBadge} title="Verified">
                  <svg viewBox="0 0 24 24" width="16" height="16" style={{marginLeft: 8, verticalAlign: 'middle'}}>
                    <path fill="#aaa" d="M12,2C6.5,2,2,6.5,2,12s4.5,10,10,10s10-4.5,10-10S17.5,2,12,2z M10,17l-5-5l1.4-1.4l3.6,3.6l7.6-7.6L19,8L10,17z"/>
                  </svg>
                </span>
              )}
            </h1>
            <p style={styles.channelHandle}>{channel.handle}</p>
            <div style={styles.channelStatsRow}>
              <span style={styles.channelStatItem}>
                <strong>{formatNumber(channel.subscriberCount)}</strong> subscribers
              </span>
              <span style={styles.channelStatItem}>
                <strong>{formatNumber(channel.videosCount)}</strong> videos
              </span>
            </div>
          </div>
        </div>

        {/* About Section */}
        <div style={styles.channelAbout}>
          <h3 style={styles.aboutTitle}>About</h3>
          <p style={styles.aboutText}>{channel.description || 'No description available'}</p>

          <div style={styles.channelLinks}>
            {channel.url && (
              <a href={channel.url} target="_blank" rel="noopener noreferrer" style={styles.channelLink}>
                View on YouTube
              </a>
            )}
            {channel.rssUrl && (
              <a href={channel.rssUrl} target="_blank" rel="noopener noreferrer" style={styles.channelLink}>
                RSS Feed
              </a>
            )}
          </div>

          {channel.keywords && channel.keywords.length > 0 && (
            <div style={styles.keywordsSection}>
              <h4 style={styles.keywordsTitle}>Keywords</h4>
              <div style={styles.keywordsList}>
                {channel.keywords.slice(0, 20).map((keyword, i) => (
                  <span key={i} style={styles.keywordTag}>{keyword}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Playlist
  if (type === 'Playlist') {
    const data = result.data;
    const videos = data.videos || data;
    const playlist = data.playlist;

    if (!Array.isArray(videos) || videos.length === 0) {
      return <div style={styles.noResults}>No videos in playlist</div>;
    }

    return (
      <div style={styles.playlistPage}>
        {/* Playlist Header */}
        {playlist && (
          <div style={styles.playlistSidebar}>
            <div style={styles.playlistCover}>
              {playlist.thumbnail ? (
                <img src={playlist.thumbnail} alt={playlist.title} style={styles.playlistCoverImg} />
              ) : (
                <div style={styles.playlistCoverPlaceholder}>
                  <svg viewBox="0 0 24 24" width="48" height="48">
                    <path fill="#aaa" d="M15,6H3v2h12V6z M15,10H3v2h12V10z M3,16h8v-2H3V16z M17,6v8.18C16.69,14.07,16.35,14,16,14c-1.66,0-3,1.34-3,3s1.34,3,3,3s3-1.34,3-3V8h3V6H17z"/>
                  </svg>
                </div>
              )}
            </div>
            <h2 style={styles.playlistTitle}>{playlist.title}</h2>
            <p style={styles.playlistAuthor}>{playlist.author}</p>
            <div style={styles.playlistMeta}>
              <span>{playlist.videoCount} videos</span>
              {playlist.viewCount && <span>{formatNumber(playlist.viewCount)} views</span>}
            </div>
            {playlist.description && (
              <p style={styles.playlistDescription}>{playlist.description}</p>
            )}
          </div>
        )}

        {/* Videos List */}
        <div style={styles.playlistVideos}>
          {videos.map((video, index) => (
            <PlaylistVideoItem key={video.id || index} video={video} index={index + 1} />
          ))}
        </div>
      </div>
    );
  }

  return <pre style={styles.jsonPre}>{JSON.stringify(result, null, 2)}</pre>;
}

// Playlist Video Item (horizontal layout)
function PlaylistVideoItem({ video, index }) {
  return (
    <div style={styles.playlistItem}>
      <span style={styles.playlistIndex}>{index}</span>
      <div style={styles.playlistItemThumb}>
        <img
          src={video.thumbnail || `https://img.youtube.com/vi/${video.id}/mqdefault.jpg`}
          alt={video.title}
          style={styles.playlistItemImg}
          onError={(e) => {
            e.target.src = 'https://via.placeholder.com/120x68?text=No+Thumbnail';
          }}
        />
        {video.duration && <span style={styles.playlistItemDuration}>{video.duration}</span>}
      </div>
      <div style={styles.playlistItemInfo}>
        <h4 style={styles.playlistItemTitle}>{video.title}</h4>
        <p style={styles.playlistItemChannel}>{video.channel?.name || video.author}</p>
      </div>
    </div>
  );
}

// Search Result Card
function SearchResultCard({ item, type }) {
  if (type === 'video') {
    return <VideoCard video={item} />;
  }

  if (type === 'channel') {
    return (
      <div style={styles.channelCard}>
        <div style={styles.channelCardAvatar}>
          {item.thumbnail ? (
            <img src={item.thumbnail} alt={item.name} style={styles.channelCardImg} />
          ) : (
            <span style={styles.channelCardInitial}>{item.name?.charAt(0) || 'C'}</span>
          )}
        </div>
        <div style={styles.channelCardInfo}>
          <h4 style={styles.channelCardName}>
            {item.name}
            {item.isVerified && <span style={styles.verifiedSmall}> ✓</span>}
          </h4>
          <p style={styles.channelCardMeta}>
            {item.subscriber_count} {item.video_count && `• ${item.video_count}`}
          </p>
          {item.description && (
            <p style={styles.channelCardDesc}>{item.description.substring(0, 120)}...</p>
          )}
        </div>
      </div>
    );
  }

  if (type === 'playlist') {
    return (
      <div style={styles.playlistCard}>
        <div style={styles.playlistCardThumb}>
          <img
            src={item.thumbnail || 'https://via.placeholder.com/320x180'}
            alt={item.title}
            style={styles.playlistCardImg}
          />
          <div style={styles.playlistCardOverlay}>
            <span style={styles.playlistCardCount}>{item.video_count}</span>
            <svg viewBox="0 0 24 24" width="24" height="24" style={{marginTop: 4}}>
              <path fill="#fff" d="M15,6H3v2h12V6z M15,10H3v2h12V10z M3,16h8v-2H3V16z M17,6v8.18C16.69,14.07,16.35,14,16,14c-1.66,0-3,1.34-3,3s1.34,3,3,3s3-1.34,3-3V8h3V6H17z"/>
            </svg>
          </div>
        </div>
        <div style={styles.playlistCardInfo}>
          <h4 style={styles.playlistCardTitle}>{item.title}</h4>
          <p style={styles.playlistCardAuthor}>{item.author}</p>
          <p style={styles.playlistCardMeta}>View full playlist</p>
        </div>
      </div>
    );
  }

  return null;
}

// Video Card
function VideoCard({ video }) {
  return (
    <a
      href={`https://www.youtube.com/watch?v=${video.id}`}
      target="_blank"
      rel="noopener noreferrer"
      style={styles.videoCardLink}
    >
      <div style={styles.videoCard}>
        <div style={styles.videoCardThumb}>
          <img
            src={video.thumbnail || `https://img.youtube.com/vi/${video.id}/mqdefault.jpg`}
            alt={video.title}
            style={styles.videoCardImg}
            onError={(e) => {
              e.target.src = 'https://via.placeholder.com/320x180?text=No+Thumbnail';
            }}
          />
          {video.duration && <span style={styles.videoDuration}>{video.duration}</span>}
          {video.isLive && <span style={styles.liveIndicator}>LIVE</span>}
          {video.isShort && <span style={styles.shortIndicator}>SHORT</span>}
          {video.isUpcoming && <span style={styles.upcomingIndicator}>UPCOMING</span>}
        </div>
        <div style={styles.videoCardContent}>
          <h4 style={styles.videoCardTitle}>{video.title}</h4>
          <p style={styles.videoCardChannel}>
            {video.channel?.name || video.author}
            {(video.isVerified || video.channel?.isVerified) && (
              <span style={styles.verifiedSmall}> ✓</span>
            )}
          </p>
          <p style={styles.videoCardMeta}>
            {video.view_count || (video.viewCount && formatNumber(video.viewCount) + ' views')}
            {(video.published || video.uploadDate) && ` • ${video.published || video.uploadDate}`}
          </p>
          {video.watchingCount && (
            <p style={styles.watchingNow}>{formatNumber(video.watchingCount)} watching now</p>
          )}
        </div>
      </div>
    </a>
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
  resultsSection: {
    marginTop: '24px',
  },
  resultsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  resultsTitle: {
    fontSize: '18px',
    fontWeight: '500',
    color: '#fff',
  },
  toggleBtn: {
    padding: '8px 16px',
    backgroundColor: '#272727',
    color: '#fff',
    border: '1px solid #404040',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  rawJson: {
    backgroundColor: '#181818',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '24px',
    maxHeight: '400px',
    overflow: 'auto',
    border: '1px solid #303030',
  },
  jsonPre: {
    margin: 0,
    fontSize: '12px',
    color: '#8ab4f8',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontFamily: 'Monaco, Consolas, monospace',
  },
  visualResults: {
    minHeight: '200px',
  },
  noResults: {
    textAlign: 'center',
    padding: '48px',
    color: '#aaa',
    fontSize: '16px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '20px',
  },
  // Health Check Card
  healthCard: {
    backgroundColor: '#1a472a',
    borderRadius: '12px',
    padding: '32px',
    textAlign: 'center',
    maxWidth: '400px',
    margin: '0 auto',
  },
  healthIcon: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: '#2e7d32',
    color: '#fff',
    fontSize: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
  },
  healthTitle: {
    fontSize: '20px',
    fontWeight: '500',
    marginBottom: '8px',
  },
  healthText: {
    color: '#aaa',
    marginBottom: '16px',
  },
  healthMeta: {
    display: 'flex',
    justifyContent: 'center',
    gap: '24px',
    color: '#81c784',
    fontSize: '14px',
  },
  // Video Card
  videoCardLink: {
    textDecoration: 'none',
    color: 'inherit',
  },
  videoCard: {
    cursor: 'pointer',
    transition: 'transform 0.2s',
  },
  videoCardThumb: {
    position: 'relative',
    aspectRatio: '16/9',
    backgroundColor: '#303030',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  videoCardImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  videoDuration: {
    position: 'absolute',
    bottom: '8px',
    right: '8px',
    backgroundColor: 'rgba(0,0,0,0.8)',
    color: '#fff',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
  },
  liveIndicator: {
    position: 'absolute',
    bottom: '8px',
    right: '8px',
    backgroundColor: '#ff0000',
    color: '#fff',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
  },
  shortIndicator: {
    position: 'absolute',
    bottom: '8px',
    left: '8px',
    backgroundColor: '#ff0000',
    color: '#fff',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
  },
  upcomingIndicator: {
    position: 'absolute',
    top: '8px',
    left: '8px',
    backgroundColor: '#065fd4',
    color: '#fff',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
  },
  videoCardContent: {
    padding: '12px 4px',
  },
  videoCardTitle: {
    fontSize: '14px',
    fontWeight: '500',
    margin: '0 0 8px 0',
    color: '#fff',
    lineHeight: '1.4',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  videoCardChannel: {
    fontSize: '12px',
    color: '#aaa',
    margin: '0 0 4px 0',
  },
  videoCardMeta: {
    fontSize: '12px',
    color: '#aaa',
    margin: 0,
  },
  watchingNow: {
    fontSize: '12px',
    color: '#ff0000',
    margin: '4px 0 0 0',
    fontWeight: '500',
  },
  verifiedSmall: {
    color: '#aaa',
    fontSize: '12px',
  },
  // Channel Card
  channelCard: {
    display: 'flex',
    gap: '16px',
    padding: '16px',
    backgroundColor: '#181818',
    borderRadius: '12px',
    alignItems: 'center',
  },
  channelCardAvatar: {
    width: '88px',
    height: '88px',
    borderRadius: '50%',
    backgroundColor: '#303030',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  channelCardImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  channelCardInitial: {
    fontSize: '36px',
    color: '#fff',
  },
  channelCardInfo: {
    flex: 1,
    minWidth: 0,
  },
  channelCardName: {
    fontSize: '16px',
    fontWeight: '500',
    margin: '0 0 4px 0',
    color: '#fff',
  },
  channelCardMeta: {
    fontSize: '13px',
    color: '#aaa',
    margin: '0 0 8px 0',
  },
  channelCardDesc: {
    fontSize: '12px',
    color: '#717171',
    margin: 0,
    lineHeight: '1.4',
  },
  // Playlist Card
  playlistCard: {
    cursor: 'pointer',
  },
  playlistCardThumb: {
    position: 'relative',
    aspectRatio: '16/9',
    backgroundColor: '#303030',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  playlistCardImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  playlistCardOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '50%',
    background: 'rgba(0,0,0,0.8)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
  },
  playlistCardCount: {
    fontSize: '16px',
    fontWeight: '500',
  },
  playlistCardInfo: {
    padding: '12px 4px',
  },
  playlistCardTitle: {
    fontSize: '14px',
    fontWeight: '500',
    margin: '0 0 4px 0',
    color: '#fff',
    lineHeight: '1.4',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  playlistCardAuthor: {
    fontSize: '12px',
    color: '#aaa',
    margin: '0 0 4px 0',
  },
  playlistCardMeta: {
    fontSize: '12px',
    color: '#717171',
    margin: 0,
  },
  // Video Details Page
  videoDetailsContainer: {
    maxWidth: '1000px',
  },
  videoMain: {},
  videoPlayer: {
    position: 'relative',
    aspectRatio: '16/9',
    backgroundColor: '#000',
    borderRadius: '12px',
    overflow: 'hidden',
    marginBottom: '16px',
  },
  videoLink: {
    display: 'block',
    width: '100%',
    height: '100%',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    cursor: 'pointer',
    opacity: 0.9,
  },
  videoTitle: {
    fontSize: '20px',
    fontWeight: '600',
    margin: '0 0 16px 0',
    lineHeight: '1.4',
  },
  videoStats: {
    display: 'flex',
    gap: '24px',
    flexWrap: 'wrap',
    marginBottom: '16px',
    padding: '16px',
    backgroundColor: '#181818',
    borderRadius: '12px',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  statValue: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#fff',
  },
  statLabel: {
    fontSize: '12px',
    color: '#aaa',
  },
  liveBadgeLarge: {
    backgroundColor: '#ff0000',
    color: '#fff',
    padding: '4px 12px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '600',
    alignSelf: 'center',
  },
  channelRow: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    padding: '16px 0',
    borderBottom: '1px solid #303030',
    marginBottom: '16px',
  },
  channelAvatar: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    backgroundColor: '#303030',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    color: '#fff',
    flexShrink: 0,
  },
  channelMeta: {},
  channelNameLink: {
    fontSize: '16px',
    fontWeight: '500',
    margin: '0 0 4px 0',
    color: '#fff',
  },
  channelSubs: {
    fontSize: '12px',
    color: '#aaa',
  },
  descriptionBox: {
    backgroundColor: '#181818',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '16px',
  },
  sectionHeader: {
    fontSize: '14px',
    fontWeight: '600',
    margin: '0 0 12px 0',
    color: '#fff',
  },
  descriptionText: {
    fontSize: '14px',
    color: '#aaa',
    lineHeight: '1.6',
    margin: 0,
    whiteSpace: 'pre-wrap',
  },
  chaptersBox: {
    backgroundColor: '#181818',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '16px',
  },
  chaptersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  chapterItem: {
    display: 'flex',
    gap: '12px',
    padding: '8px',
    borderRadius: '8px',
    backgroundColor: '#212121',
  },
  chapterTime: {
    color: '#3ea6ff',
    fontSize: '14px',
    fontWeight: '500',
    minWidth: '60px',
  },
  chapterTitle: {
    color: '#fff',
    fontSize: '14px',
  },
  transcriptBox: {
    backgroundColor: '#181818',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '16px',
  },
  transcriptStatus: {
    color: '#aaa',
    fontWeight: '400',
    marginLeft: '8px',
  },
  transcriptContent: {
    fontSize: '14px',
    color: '#aaa',
    lineHeight: '1.8',
    maxHeight: '400px',
    overflow: 'auto',
    whiteSpace: 'pre-wrap',
  },
  // Channel Page
  channelPage: {},
  channelBanner: {
    width: '100%',
    height: '180px',
    borderRadius: '12px',
    overflow: 'hidden',
    marginBottom: '24px',
  },
  bannerImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  channelPageHeader: {
    display: 'flex',
    gap: '24px',
    marginBottom: '24px',
  },
  channelAvatarLarge: {
    width: '128px',
    height: '128px',
    borderRadius: '50%',
    backgroundColor: '#303030',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '48px',
    color: '#fff',
    flexShrink: 0,
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  channelPageInfo: {
    flex: 1,
  },
  channelPageName: {
    fontSize: '28px',
    fontWeight: '600',
    margin: '0 0 8px 0',
    color: '#fff',
  },
  verifiedBadge: {
    display: 'inline-flex',
    alignItems: 'center',
  },
  channelHandle: {
    fontSize: '14px',
    color: '#aaa',
    margin: '0 0 12px 0',
  },
  channelStatsRow: {
    display: 'flex',
    gap: '16px',
  },
  channelStatItem: {
    fontSize: '14px',
    color: '#aaa',
  },
  channelAbout: {
    backgroundColor: '#181818',
    borderRadius: '12px',
    padding: '24px',
  },
  aboutTitle: {
    fontSize: '16px',
    fontWeight: '600',
    margin: '0 0 12px 0',
    color: '#fff',
  },
  aboutText: {
    fontSize: '14px',
    color: '#aaa',
    lineHeight: '1.6',
    margin: '0 0 16px 0',
    whiteSpace: 'pre-wrap',
  },
  channelLinks: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
  },
  channelLink: {
    color: '#3ea6ff',
    fontSize: '14px',
    textDecoration: 'none',
  },
  keywordsSection: {
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '1px solid #303030',
  },
  keywordsTitle: {
    fontSize: '14px',
    fontWeight: '500',
    margin: '0 0 12px 0',
    color: '#aaa',
  },
  keywordsList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  keywordTag: {
    backgroundColor: '#272727',
    color: '#aaa',
    padding: '4px 12px',
    borderRadius: '16px',
    fontSize: '12px',
  },
  // Playlist Page
  playlistPage: {
    display: 'grid',
    gridTemplateColumns: '340px 1fr',
    gap: '24px',
  },
  playlistSidebar: {
    backgroundColor: 'linear-gradient(180deg, #272727 0%, #181818 100%)',
    background: 'linear-gradient(180deg, #272727 0%, #181818 100%)',
    borderRadius: '12px',
    padding: '24px',
    position: 'sticky',
    top: '100px',
    height: 'fit-content',
  },
  playlistCover: {
    aspectRatio: '16/9',
    borderRadius: '12px',
    overflow: 'hidden',
    marginBottom: '16px',
    backgroundColor: '#303030',
  },
  playlistCoverImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  playlistCoverPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistTitle: {
    fontSize: '20px',
    fontWeight: '600',
    margin: '0 0 8px 0',
    color: '#fff',
  },
  playlistAuthor: {
    fontSize: '14px',
    color: '#aaa',
    margin: '0 0 8px 0',
  },
  playlistMeta: {
    fontSize: '12px',
    color: '#717171',
    display: 'flex',
    gap: '8px',
    marginBottom: '12px',
  },
  playlistDescription: {
    fontSize: '13px',
    color: '#aaa',
    lineHeight: '1.5',
    margin: 0,
  },
  playlistVideos: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  playlistItem: {
    display: 'flex',
    gap: '12px',
    padding: '8px',
    borderRadius: '8px',
    alignItems: 'flex-start',
    cursor: 'pointer',
  },
  playlistIndex: {
    width: '24px',
    textAlign: 'center',
    color: '#717171',
    fontSize: '14px',
    paddingTop: '8px',
    flexShrink: 0,
  },
  playlistItemThumb: {
    position: 'relative',
    width: '160px',
    aspectRatio: '16/9',
    borderRadius: '8px',
    overflow: 'hidden',
    backgroundColor: '#303030',
    flexShrink: 0,
  },
  playlistItemImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  playlistItemDuration: {
    position: 'absolute',
    bottom: '4px',
    right: '4px',
    backgroundColor: 'rgba(0,0,0,0.8)',
    color: '#fff',
    padding: '2px 4px',
    borderRadius: '2px',
    fontSize: '11px',
    fontWeight: '500',
  },
  playlistItemInfo: {
    flex: 1,
    minWidth: 0,
    paddingTop: '4px',
  },
  playlistItemTitle: {
    fontSize: '14px',
    fontWeight: '500',
    margin: '0 0 4px 0',
    color: '#fff',
    lineHeight: '1.4',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  playlistItemChannel: {
    fontSize: '12px',
    color: '#aaa',
    margin: 0,
  },
};
