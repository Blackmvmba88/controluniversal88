const collectLib = require('../server/collect_lib');
const fs = require('fs');
const http = require('http');

async function testCollectLibValidation() {
  // remove sample file to make test deterministic
  try {
    if (fs.existsSync('.ds4map.samples.json')) fs.unlinkSync('.ds4map.samples.json');
  } catch (e) {}
  // collect simulated samples for label 'cross'
  const mapping = await collectLib.collectSamples(
    { label: 'cross', count: 3, simulate: true, save: false },
    (s) => {}
  );
  if (!mapping || !mapping.buttons) throw new Error('no mapping returned');
  if (!mapping._validation) throw new Error('validation info missing');
  if (!mapping._validation.ok)
    throw new Error('validation failed: ' + JSON.stringify(mapping._validation.details));
}

function postAuto(count, save) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ count, save });
    const req = http.request(
      {
        method: 'POST',
        host: 'localhost',
        port: 8080,
        path: '/api/collect/auto',
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

async function testCollectAutoSaveEndpoint() {
  // ensure previous map removed
  try {
    if (fs.existsSync('.ds4map.json')) fs.unlinkSync('.ds4map.json');
  } catch (e) {}
  await postAuto(1, true);
  const start = Date.now();
  let job;
  while (Date.now() - start < 20000) {
    job = await getStatus();
    if (job && job.status === 'done') break;
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!job || job.status !== 'done') throw new Error('job did not finish');
  if (!job.validation) throw new Error('validation info missing in job');
  if (!job.validation.ok)
    throw new Error('validation failed for auto job: ' + JSON.stringify(job.validation.details));
  if (!job.saved) throw new Error('mapping was not saved');
  if (!fs.existsSync('.ds4map.json')) throw new Error('.ds4map.json should exist after save');
}

module.exports = { testCollectLibValidation, testCollectAutoSaveEndpoint };
