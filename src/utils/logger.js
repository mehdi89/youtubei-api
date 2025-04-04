const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
};

const icons = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  fetch: '🔄'
};

function formatMessage(icon, status, message, details = '') {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
  const detailsStr = details ? ` | ${colors.gray}${details}${colors.reset}` : '';
  return `${timestamp} ${icon} ${status}: ${message}${detailsStr}`;
}

const logger = {
  success: (message, details) => {
    console.log(formatMessage(icons.success, 'SUCCESS', message, details));
  },
  error: (message, details) => {
    console.error(formatMessage(icons.error, 'ERROR', message, details));
  },
  warn: (message, details) => {
    console.warn(formatMessage(icons.warning, 'WARN', message, details));
  },
  info: (message, details) => {
    console.info(formatMessage(icons.info, 'INFO', message, details));
  },
  fetch: (message, details) => {
    console.log(formatMessage(icons.fetch, 'FETCH', message, details));
  }
};

export default logger; 