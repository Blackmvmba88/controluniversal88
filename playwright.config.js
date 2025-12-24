// Playwright config: starts the app with `npm run start:sim` when running tests locally
/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  timeout: 30 * 1000,
  testDir: 'tests/playwright',
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 }
  },
  webServer: {
    command: 'npm run start:sim',
    port: 8080,
    timeout: 15000,
    reuseExistingServer: process.env.CI ? false : true
  }
};
