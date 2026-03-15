// Deterministic simulator: emits a predefined sequence of events to the WebSocket server
const WebSocket = require('ws');
const url = process.env.URL || 'ws://localhost:8080';
const seq = [
  { type: 'button', id: 'cross', value: 1 },
  { type: 'button', id: 'cross', value: 0 },
  { type: 'button', id: 'circle', value: 1 },
  { type: 'button', id: 'circle', value: 0 },
  { type: 'axis', id: 'lstick_x', value: 0.5 },
  { type: 'axis', id: 'lstick_x', value: 0.0 },
];

(async function () {
  const ws = new WebSocket(url);
  ws.on('open', () => {
    console.log('Connected to', url);
    let i = 0;
    const t = setInterval(() => {
      if (i >= seq.length) {
        clearInterval(t);
        ws.close();
        return;
      }
      ws.send(JSON.stringify(seq[i]));
      console.log('sent', seq[i]);
      i++;
    }, 300);
  });
  ws.on('close', () => process.exit(0));
  ws.on('error', (e) => {
    console.error('WS err', e);
    process.exit(1);
  });
})();
