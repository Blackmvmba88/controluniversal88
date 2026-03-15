const { test, expect } = require('@playwright/test');

// Check that the UI copy button writes the snippet to the clipboard

test('bookmarklet snippet can be copied to clipboard', async ({ page }) => {
  const BASE = process.env.BASE_URL || 'http://localhost:8080';
  await page.goto(`${BASE}/monitor.html`);
  // allow clipboard permissions for this test origin
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  await page.fill('#remote-url', 'ws://127.0.0.1:12345');
  await page.click('#remote-gen');
  await page.waitForSelector('#bookmarklet-snippet');
  // Use Playwright clipboard API
  await page.click('#bookmarklet-copy');
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain('connectToController');
});
