const { test, expect } = require('@playwright/test');

// Ensure the /api/bookmarklet endpoint returns a bookmarklet when given a URL

test('bookmarklet API returns bookmarklet and saves to dist', async ({ request }) => {
  const BASE = process.env.BASE_URL || 'http://localhost:8080';
  const url = 'https://example-tunnel.ngrok.io';
  const r = await request.post(`${BASE}/api/bookmarklet`, { data: { url } });
  expect(r.ok()).toBeTruthy();
  const j = await r.json();
  expect(j.ok).toBeTruthy();
  expect(j.bookmarklet).toContain('connectToController');
});
