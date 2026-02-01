const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const DEFAULT = process.env.LOG_LEVEL || 'info';
let level = LEVELS[DEFAULT] !== undefined ? DEFAULT : 'info';

function setLevel(lvl) {
  if (LEVELS[lvl] !== undefined) level = lvl;
}
function enabled(lvl) {
  return LEVELS[lvl] <= LEVELS[level];
}

module.exports = {
  setLevel,
  error: (...args) => {
    if (enabled('error')) console.error('[ERROR]', ...args);
  },
  warn: (...args) => {
    if (enabled('warn')) console.warn('[WARN]', ...args);
  },
  info: (...args) => {
    if (enabled('info')) console.log('[INFO]', ...args);
  },
  debug: (...args) => {
    if (enabled('debug')) console.debug('[DEBUG]', ...args);
  },
};
