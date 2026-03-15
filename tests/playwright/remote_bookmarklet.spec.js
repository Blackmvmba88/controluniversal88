const { test, expect } = require('@playwright/test');
const WebSocket = require('ws');

// Test the Monitor UI remote bookmarklet helpers: generate & test connection

test('generate bookmarklet shows correct host and test remote connects', async ({ page }) => {
  // start a simple WS server to accept test connections
  const wss = new WebSocket.Server({ port: 0 });
  const port = wss.address().port;
  const wsUrl = `ws://127.0.0.1:${port}`;

  // respond to any handshake
  wss.on('connection', (s) => {
    s.on('message', () => {});
  });

  const BASE = process.env.BASE_URL || 'http://localhost:8080';
  await page.goto(`${BASE}/monitor.html`);
  await page.waitForSelector('#remote-url');
  await page.fill('#remote-url', wsUrl);

  // click generate and assert the snippet is shown in the UI
  await page.click('#remote-gen');
  await page.waitForSelector('#bookmarklet-snippet', { timeout: 1000 });
  const snippet = await page.$eval('#bookmarklet-snippet', (el) => el.innerText);
  expect(snippet).toContain(wsUrl.replace(/^wss?:\/\//, ''));

  // test remote connection button - this should show 'connected' in #remote-status
  await page.click('#remote-test');
  await page.waitForFunction(
    () =>
      document.getElementById('remote-status') &&
      document.getElementById('remote-status').innerText === 'connected',
    null,
    { timeout: 3000 }
  );

  wss.close();
});
