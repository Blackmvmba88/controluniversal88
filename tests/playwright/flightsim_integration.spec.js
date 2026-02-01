const { test, expect } = require('@playwright/test');

// End-to-end integration test: monitor -> server -> flightsim stub
// Steps:
// 1. Open monitor.html and enable keyboard control
// 2. Open flightsim_stub.html and inject the bookmarklet connect (to local WS)
// 3. Press ArrowUp on monitor; expect FlightSim to receive F18 keydown and keyup

test('monitor sends f18 and FlightSim receives keyboard events via server', async ({ browser }) => {
  const context = await browser.newContext();
  const monitor = await context.newPage();
  const sim = await context.newPage();

  const BASE = process.env.BASE_URL || 'http://localhost:8080';
  await monitor.goto(`${BASE}/monitor.html`);
  await sim.goto(`${BASE}/flightsim_stub.html`);

  // connect the stub to the server WS by evaluating bookmarklet logic using local WS url
  const wsUrl = process.env.SERVER_WS || BASE.replace(/^http/, 'ws');
  await sim.addScriptTag({ url: '/bookmarklet.js' });
  await sim.evaluate((u) => {
    // connectToController available from bookmarklet.js
    window.connectToController(u);
  }, wsUrl);

  // enable keyboard control in monitor
  await monitor.waitForSelector('#kb-enable');
  await monitor.check('#kb-enable');

  // press ArrowUp on monitor (this should cause axis + button messages to be sent and rebroadcast)
  await monitor.keyboard.down('ArrowUp');

  // wait for FlightSim to see a keydown 'F18' (exposed as window.lastKey)
  await sim.waitForFunction(() => window.lastKey === 'F18', null, { timeout: 3000 });
  // verify keyup after release
  await monitor.keyboard.up('ArrowUp');
  await sim.waitForFunction(() => window.lastKeyUp === 'F18', null, { timeout: 3000 });

  await context.close();
});
