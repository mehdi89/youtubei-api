/**
 * Simple logger utility for the YouTube API
 */

const getTimestamp = () => {
  return new Date().toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

const formatMessage = (emoji, level, message, details) => {
  const timestamp = getTimestamp();
  const detailStr = details ? ` | ${details}` : '';
  return `${timestamp} ${emoji} ${level}: ${message}${detailStr}`;
};

const logger = {
  info: (message, details) => {
    console.log(formatMessage('ℹ️', 'INFO', message, details));
  },

  success: (message, details) => {
    console.log(formatMessage('✅', 'SUCCESS', message, details));
  },

  warn: (message, details) => {
    console.warn(formatMessage('⚠️', 'WARNING', message, details));
  },

  error: (message, details) => {
    console.error(formatMessage('❌', 'ERROR', message, details));
  },

  fetch: (message, details) => {
    console.log(formatMessage('🔄', 'FETCH', message, details));
  }
};

export default logger;
