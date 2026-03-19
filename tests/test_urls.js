function getBaseUrl() {
  return process.env.BASE_URL || 'http://localhost:8080';
}

function getServerUrl() {
  return process.env.SERVER_URL || 'ws://localhost:8080';
}

function getHttpRequestOptions(pathname, method = 'GET') {
  const base = new URL(getBaseUrl());
  return {
    method,
    host: base.hostname,
    port: Number(base.port || (base.protocol === 'https:' ? 443 : 80)),
    path: pathname,
  };
}

module.exports = {
  getBaseUrl,
  getHttpRequestOptions,
  getServerUrl,
};
