const path = require('path');

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'ws:', 'wss:']);

function parseRemoteUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
    throw new Error('url required');
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (err) {
    throw new Error('invalid url');
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new Error('invalid url');
  }

  if (!parsed.hostname) {
    throw new Error('invalid url');
  }

  if (parsed.username || parsed.password) {
    throw new Error('credentials are not allowed in url');
  }

  parsed.hash = '';

  return parsed;
}

function normalizeConnectionUrl(rawUrl) {
  return parseRemoteUrl(rawUrl).toString();
}

function scriptOriginFor(rawUrl) {
  const parsed = parseRemoteUrl(rawUrl);
  const protocol = parsed.protocol === 'http:' || parsed.protocol === 'ws:' ? 'http:' : 'https:';
  return `${protocol}//${parsed.host}`;
}

function buildBookmarklet(rawUrl) {
  const connectionUrl = normalizeConnectionUrl(rawUrl);
  const scriptOrigin = scriptOriginFor(connectionUrl);
  return `javascript:(function(){var s=document.createElement('script');s.src=${JSON.stringify(
    `${scriptOrigin}/bookmarklet.js`
  )};document.head.appendChild(s);setTimeout(function(){connectToController(${JSON.stringify(
    connectionUrl
  )})},200);})();`;
}

function artifactPaths(distDir, sha) {
  const filename = `bookmarklet_${sha}.txt`;
  return {
    filename,
    filePath: path.join(distDir, filename),
    metaPath: path.join(distDir, `${filename}.meta.json`),
    tokenPath: path.join(distDir, `${filename}.token.json`),
  };
}

module.exports = {
  artifactPaths,
  buildBookmarklet,
  normalizeConnectionUrl,
  parseRemoteUrl,
  scriptOriginFor,
};
