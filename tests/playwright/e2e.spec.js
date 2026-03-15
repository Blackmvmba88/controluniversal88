const { test, expect } = require('@playwright/test');

test('buttons highlight when server emits', async ({ page }) => {
  const BASE = process.env.BASE_URL || 'http://localhost:8080';
  await page.goto(`${BASE}/monitor.html`);
  // wait for a .btn.active element to appear (server simulate emits periodically)
  const el = await page.waitForSelector('.btn.active', { timeout: 15000 });
  expect(el).toBeTruthy();
});

test('axis display updates', async ({ page }) => {
  const BASE = process.env.BASE_URL || 'http://localhost:8080';
  await page.goto(`${BASE}/monitor.html`);
  const axis = await page.waitForSelector('#axis-display', { timeout: 15000 });
  const txt = await axis.textContent();
  // tolerate either local formatted 'lstick_x' or rebroadcasted 'id: ...' (simulate mode varies)
  expect(txt).toMatch(/lstick_x|throttle|id:/);
});
