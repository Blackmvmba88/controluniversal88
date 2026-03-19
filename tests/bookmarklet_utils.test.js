const {
  artifactPaths,
  buildBookmarklet,
  normalizeConnectionUrl,
  scriptOriginFor,
} = require('../server/bookmarklet');

function testBuildBookmarkletEscapesUrlSafely() {
  const snippet = buildBookmarklet('wss://example.com/socket?name=a%27b');
  if (!snippet.includes('connectToController("wss://example.com/socket?name=a%27b")')) {
    throw new Error('bookmarklet should embed normalized URL via JSON string escaping');
  }
}

function testScriptOriginMatchesProtocolFamily() {
  const secureOrigin = scriptOriginFor('wss://example.com/socket');
  const insecureOrigin = scriptOriginFor('ws://localhost:8080/socket');
  if (secureOrigin !== 'https://example.com') throw new Error('expected https origin for wss');
  if (insecureOrigin !== 'http://localhost:8080')
    throw new Error('expected http origin for ws');
}

function testNormalizeConnectionUrlRejectsCredentials() {
  let failed = false;
  try {
    normalizeConnectionUrl('https://user:pass@example.com');
  } catch (err) {
    failed = /credentials/i.test(String(err.message || err));
  }
  if (!failed) throw new Error('URL credentials should be rejected');
}

function testArtifactPathsUseExpectedNames() {
  const paths = artifactPaths('/tmp/dist', 'abc123');
  if (!paths.filePath.endsWith('/bookmarklet_abc123.txt')) throw new Error('unexpected file path');
  if (!paths.metaPath.endsWith('/bookmarklet_abc123.txt.meta.json'))
    throw new Error('unexpected meta path');
  if (!paths.tokenPath.endsWith('/bookmarklet_abc123.txt.token.json'))
    throw new Error('unexpected token path');
}

module.exports = {
  testArtifactPathsUseExpectedNames,
  testBuildBookmarkletEscapesUrlSafely,
  testNormalizeConnectionUrlRejectsCredentials,
  testScriptOriginMatchesProtocolFamily,
};
