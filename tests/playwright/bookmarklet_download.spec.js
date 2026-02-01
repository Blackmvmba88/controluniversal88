const { test, expect } = require('@playwright/test');

// Ensure clicking Download triggers a file download and content includes connectToController

test('bookmarklet download triggers file and contains connect call', async ({ page }) => {
  const BASE = process.env.BASE_URL || 'http://localhost:8080';
  await page.goto(`${BASE}/monitor.html`);
  await page.fill('#remote-url', 'ws://127.0.0.1:12345');
  await page.click('#remote-gen');
  await page.waitForSelector('#bookmarklet-snippet');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#bookmarklet-download'),
  ]);
  const path = await download.path();
  const fs = require('fs');
  const content = fs.readFileSync(path, 'utf8');
  expect(content).toContain('connectToController');
});
