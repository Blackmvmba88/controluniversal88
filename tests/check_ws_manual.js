const WebSocket = require('ws');
(async () => {
  const c1 = new WebSocket('ws://localhost:8080');
  const c2 = new WebSocket('ws://localhost:8080');
  c1.on('open', () => console.log('c1 open'));
  c2.on('open', () => console.log('c2 open'));
  c2.on('message', (m) => {
    console.log('c2 received', m.toString());
    process.exit(0);
  });
  setTimeout(() => {
    if (c1.readyState === 1) {
      c1.send(JSON.stringify({ type: 'test_ping', ok: true }));
    } else console.log('c1 not ready');
  }, 600);
  setTimeout(() => {
    console.error('timeout');
    process.exit(1);
  }, 3000);
})();
