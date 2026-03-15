const { test, expect } = require('@playwright/test');

// POST a bookmarklet with pr/author and ttl, then verify via /api/bookmarklet/verify and fetch file with token

test('bookmarklet verify and tokenized fetch works', async ({ request }) => {
  const BASE = process.env.BASE_URL || 'http://localhost:8080';
  const url = 'https://test-tunnel.example';
  const pr = 123;
  const author = 'test-author';
  const r = await request.post(`${BASE}/api/bookmarklet`, {
    data: { url, pr, author, ttl_hours: 1 },
  });
  expect(r.ok()).toBeTruthy();
  const j = await r.json();
  expect(j.ok).toBeTruthy();
  // token/file may be present or omitted depending on environment; if token exists, verify token path
  if (j.token && j.sha) {
    const v = await request.get(`${BASE}/api/bookmarklet/verify?sha=${j.sha}&token=${j.token}`);
    expect(v.ok()).toBeTruthy();
    const m = await v.json();
    expect(m.meta.author).toBe(author);

    // fetch file via fileUrl (strip host and path), simulate client request to file URL
    const fileResp = await request.get(new URL(j.fileUrl));
    expect(fileResp.ok()).toBeTruthy();
    const txt = await fileResp.text();
    expect(txt).toContain('connectToController');
  } else {
    // fallback: inline bookmarklet should be present
    expect(j.bookmarklet).toBeTruthy();
    expect(j.bookmarklet).toContain('connectToController');
  }
});
