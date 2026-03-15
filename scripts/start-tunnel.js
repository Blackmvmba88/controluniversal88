#!/usr/bin/env node
// small helper to start localtunnel programmatically and print URL
const ltt = require('localtunnel');
(async () => {
  const port = process.env.PORT || 8080;
  try {
    const tunnel = await ltt({ port: Number(port) });
    console.log('LT URL', tunnel.url);
    // keep process alive until killed
    process.on('SIGINT', async () => {
      await tunnel.close();
      process.exit(0);
    });
    process.on('SIGTERM', async () => {
      await tunnel.close();
      process.exit(0);
    });
    // prevent exit
    await new Promise(() => {});
  } catch (e) {
    console.error('failed to start tunnel', e && e.message);
    process.exit(1);
  }
})();
