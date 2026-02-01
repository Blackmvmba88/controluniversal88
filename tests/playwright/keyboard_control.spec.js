const { test, expect } = require('@playwright/test');

// Ensure server is running (Playwright CI starts the server normally)

test('enable keyboard control and ArrowUp sends throttle', async ({ page }) => {
  const BASE = process.env.BASE_URL || 'http://localhost:8080';
  await page.goto(`${BASE}/monitor.html`);
  // enable keyboard control
  const cb = await page.waitForSelector('#kb-enable');
  await cb.check();

  // ensure axis-display exists
  const axis = await page.waitForSelector('#axis-display');

  // press ArrowUp and hold, then verify display shows throttle: 1
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(200);
  const txt = await axis.textContent();
  // tolerate either the local formatted display or server-rebroadcasted 'id/value' form
  expect(txt).toMatch(/throttle/);
  expect(txt).toMatch(/(-?1(\.00)?)|value: \s*1/);

  // release ArrowUp and verify it returns to 0
  await page.keyboard.up('ArrowUp');
  await page.waitForTimeout(200);
  const txt2 = await axis.textContent();
  expect(txt2).toMatch(/throttle/);
  expect(txt2).toMatch(/(-?0(\.00)?)|value:\s*0/);
});

test('ArrowUp toggles f18 synthetic button', async ({ page }) => {
  const BASE = process.env.BASE_URL || 'http://localhost:8080';
  await page.goto(`${BASE}/monitor.html`);
  await page.waitForSelector('#kb-enable');
  await page.check('#kb-enable');

  const btn = await page.waitForSelector('#f18');

  // open a raw WS listener ahead of pressing so we don't miss the rebroadcast
  const WS = require('ws');
  const ws = new WS(process.env.SERVER_WS || 'ws://localhost:8080');
  // wait for ws to be ready
  await new Promise((res) => {
    const t = setTimeout(res, 1200);
    ws.on('open', () => {
      clearTimeout(t);
      res();
    });
  });
  let serverSeen = false;
  const wsPromise = new Promise((res) => {
    const timer = setTimeout(() => {
      try {
        ws.close();
      } catch (_) {}
      res(false);
    }, 5000);
    ws.on('message', (m) => {
      try {
        const msg = JSON.parse(m);
        if (msg && msg.type === 'button' && msg.id === 'f18' && msg.value === 1) {
          clearTimeout(timer);
          try {
            ws.close();
          } catch (_) {}
          serverSeen = true;
          res(true);
        }
      } catch (e) {}
    });
    ws.on('error', () => {
      clearTimeout(timer);
      try {
        ws.close();
      } catch (_) {}
      res(false);
    });
  });

  await page.keyboard.down('ArrowUp');
  // wait for UI update OR server rebroadcast (whichever comes first)
  let uiSeen = false;
  try {
    await page.waitForSelector('#f18.active', { timeout: 2000 });
    uiSeen = true;
  } catch (e) {
    uiSeen = false;
  }

  if (!uiSeen) {
    const got = await wsPromise;
    if (!got) throw new Error('f18 not observed in UI nor via server rebroadcast');
  }

  await page.keyboard.up('ArrowUp');
  await page.waitForSelector('#f18:not(.active)', { timeout: 1500 });
});

test('ArrowLeft/Right update yaw values', async ({ page }) => {
  const BASE = process.env.BASE_URL || 'http://localhost:8080';
  await page.goto(`${BASE}/monitor.html`);
  await page.waitForSelector('#kb-enable');
  await page.check('#kb-enable');
  const axis = await page.waitForSelector('#axis-display');

  // open a raw WS listener ahead of pressing so we don't miss the rebroadcast
  const WS = require('ws');
  const ws = new WS(process.env.SERVER_WS || 'ws://localhost:8080');
  let serverSeen = false;
  const wsPromise = new Promise((res) => {
    const timer = setTimeout(() => {
      try {
        ws.close();
      } catch (_) {}
      res(false);
    }, 4000);
    ws.on('message', (m) => {
      try {
        const msg = JSON.parse(m);
        if (
          msg &&
          msg.type === 'axis' &&
          msg.id === 'yaw' &&
          (msg.value === -1 || msg.value === '-1')
        ) {
          clearTimeout(timer);
          try {
            ws.close();
          } catch (_) {}
          serverSeen = true;
          res(true);
        }
      } catch (e) {}
    });
    ws.on('error', () => {
      clearTimeout(timer);
      try {
        ws.close();
      } catch (_) {}
      res(false);
    });
  });

  await page.keyboard.down('ArrowLeft');
  // wait up to 3s for the axis display to reflect yaw changes; fallback to server check if UI delayed
  let seen = false;
  try {
    await page.waitForFunction(
      () =>
        document.getElementById('axis-display') &&
        document.getElementById('axis-display').innerText.includes('yaw'),
      null,
      { timeout: 3000 }
    );
    seen = true;
  } catch (e) {
    seen = false;
  }
  if (!seen) {
    const got = await wsPromise;
    if (!got) throw new Error('yaw not observed in UI nor via server');
  }
  const left = await axis.textContent();
  // allow either UI or server 'id/value' form
  expect(left).toMatch(/(-?1(\.00)?)|value:\s*-1/);
  await page.keyboard.up('ArrowLeft');

  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(
    () =>
      document.getElementById('axis-display') &&
      document.getElementById('axis-display').innerText.includes('yaw'),
    null,
    { timeout: 1500 }
  );
  const right = await axis.textContent();
  expect(right).toMatch(/(-?1(\.00)?)|value:\s*1/);
  await page.keyboard.up('ArrowRight');
});
