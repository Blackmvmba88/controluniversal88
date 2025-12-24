const { test, expect } = require('@playwright/test');

test('buttons highlight when server emits', async ({ page }) => {
  await page.goto('http://localhost:8080');
  // wait for a .btn.active element to appear (server simulate emits periodically)
  const el = await page.waitForSelector('.btn.active', { timeout: 15000 });
  expect(el).toBeTruthy();
});

test('axis display updates', async ({ page }) => {
  await page.goto('http://localhost:8080');
  const axis = await page.waitForSelector('#axis-display', { timeout: 15000 });
  const txt = await axis.textContent();
  expect(txt).toMatch(/lstick_x/);
});
