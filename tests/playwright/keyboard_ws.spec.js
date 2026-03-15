const { test, expect } = require('@playwright/test');
const WebSocket = require('ws');

// Verify the keyboard client sends axis/button messages to the server which are rebroadcast
// to other clients (we connect a raw WS client and observe messages).

test('keyboard client sends axis and f18 button via server', async ({ page }) => {
  const serverUrl = process.env.SERVER_WS || 'ws://localhost:8080';
  const ws = new WebSocket(serverUrl);
  const received = [];

  await new Promise((res, rej) => {
    ws.on('open', res);
    ws.on('error', rej);
  });
  ws.on('message', (m) => {
    try {
      received.push(JSON.parse(m));
    } catch (e) {}
  });

  const BASE = process.env.BASE_URL || 'http://localhost:8080';
  await page.goto(`${BASE}/monitor.html`);
  await page.waitForSelector('#kb-enable');
  await page.check('#kb-enable');

  // press and release ArrowUp
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(300);
  await page.keyboard.up('ArrowUp');
  await page.waitForTimeout(300);

  // allow messages to arrive
  await new Promise((r) => setTimeout(r, 200));

  const hasF18Press = received.some((m) => m.type === 'button' && m.id === 'f18' && m.value === 1);
  const hasThrottle = received.some(
    (m) => m.type === 'axis' && m.id === 'throttle' && (m.value === 1 || m.value === '1')
  );

  expect(hasF18Press).toBeTruthy();
  expect(hasThrottle).toBeTruthy();

  ws.close();
});
