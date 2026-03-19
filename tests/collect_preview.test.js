const http = require('http');
const fs = require('fs');
const { getBaseUrl, getHttpRequestOptions } = require('./test_urls');

function postAuto(count) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ count });
    const req = http.request(
      {
        ...getHttpRequestOptions('/api/collect/auto', 'POST'),
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      },
      (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => resolve(JSON.parse(body)));
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getStatus() {
  return new Promise((resolve, reject) => {
    http
      .get(`${getBaseUrl()}/api/collect/status`, (res) => {
        let b = '';
        res.on('data', (d) => (b += d));
        res.on('end', () => {
          try {
            resolve(JSON.parse(b));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

async function testCollectPreview() {
  if (fs.existsSync('.ds4map.json')) fs.unlinkSync('.ds4map.json');
  await postAuto(2);
  const start = Date.now();
  let job;
  while (Date.now() - start < 30000) {
    job = await getStatus();
    if (job && job.status === 'done') break;
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!job || job.status !== 'done') throw new Error('job did not finish');
  if (!job.result || !job.result.buttons) throw new Error('no result mapping in preview');
  // ensure file not saved yet
  if (fs.existsSync('.ds4map.json')) {
    throw new Error('.ds4map.json should not be saved during preview');
  }
  // now commit via save endpoint
  await new Promise((resolve, reject) => {
    const data = JSON.stringify(job.result);
    const req = http.request(
      {
        ...getHttpRequestOptions('/api/save-map', 'POST'),
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      },
      (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            console.error('Save failed with status', res.statusCode, 'body:', body);
            console.error('Sent data:', data);
            reject(new Error('save failed: ' + body));
          } else {
            resolve();
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
  if (!fs.existsSync('.ds4map.json')) throw new Error('save failed');
}

module.exports = { testCollectPreview };
