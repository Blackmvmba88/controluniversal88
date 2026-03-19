const http = require('http');
const { getBaseUrl } = require('./test_urls');

function testStatusApi() {
  return new Promise((resolve, reject) => {
    http
      .get(`${getBaseUrl()}/api/status`, (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => {
          try {
            const j = JSON.parse(body);
            if (!j || typeof j !== 'object') return reject(new Error('invalid json'));
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

module.exports = { testStatusApi };
