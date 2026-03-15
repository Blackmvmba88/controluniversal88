const http = require('http');
const fs = require('fs');

function postStart(label, count, save) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ label, count, save });
    const req = http.request(
      {
        method: 'POST',
        host: 'localhost',
        port: 8080,
        path: '/api/collect/start',
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
      .get('http://localhost:8080/api/collect/status', (res) => {
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

async function testGuidedApiFlow() {
  // run two labels sequentially in preview mode
  await postStart('cross', 1, false);
  // wait done
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 200));
    const s = await getStatus();
    if (s && s.status === 'done') break;
  }
  let s1 = await getStatus();
  if (!s1.result || !s1.result.buttons) throw new Error('no result for cross');

  await postStart('circle', 1, false);
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 200));
    const s = await getStatus();
    if (s && s.status === 'done') break;
  }
  let s2 = await getStatus();
  if (!s2.result || !s2.result.buttons) throw new Error('no result for circle');

  // combine and save
  const final = Object.assign({ axes: {}, dpad: { byte: null, mask: 15 }, buttons: {} }, s1.result);
  Object.assign(final.buttons, s2.result.buttons);
  // save via API
  await new Promise((resolve, reject) => {
    const data = JSON.stringify(final);
    const req = http.request(
      {
        method: 'POST',
        host: 'localhost',
        port: 8080,
        path: '/api/save-map',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      },
      (res) => {
        res.on('data', () => {});
        res.on('end', resolve);
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
  if (!fs.existsSync('.ds4map.json')) throw new Error('save failed');
}

module.exports = { testGuidedApiFlow };
