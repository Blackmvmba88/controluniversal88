// Lightweight bookmarklet script served from /bookmarklet.js
// Usage: call connectToController('wss://your-ngrok-url') from console or via bookmarklet
(function () {
  window.connectToController = function (wsUrl) {
    if (!wsUrl) throw new Error('wsUrl required');
    let ws;
    function start() {
      try {
        ws = new WebSocket(wsUrl.replace(/^https?:/, 'ws:').replace(/^wss?:/, (m) => m));
      } catch (e) {
        console.warn('Bookmarklet WS create failed', e);
        return;
      }
      ws.addEventListener('open', () => console.log('Bookmarklet WS open', wsUrl));
      ws.addEventListener('close', () => {
        console.log('Bookmarklet WS closed, reconnecting in 1s');
        setTimeout(start, 1000);
      });
      ws.addEventListener('error', (e) => console.warn('Bookmarklet WS error', e));
      ws.addEventListener('message', (m) => {
        try {
          const msg = JSON.parse(m.data);
          if (!msg || typeof msg.type !== 'string') return;
          if (msg.type === 'button' && msg.id === 'f18') {
            const evType = msg.value === 1 ? 'keydown' : 'keyup';
            const e = new KeyboardEvent(evType, {
              key: 'F18',
              code: 'F18',
              bubbles: true,
              cancelable: true,
            });
            console.log('Bookmarklet dispatch', evType, 'for', 'F18');
            window.dispatchEvent(e);
          } else if (msg.type === 'axis') {
            // optional: dispatch a custom event with axis info
            const ev = new CustomEvent('controller:axis', { detail: msg });
            window.dispatchEvent(ev);
          }
        } catch (e) {
          console.warn('Bookmarklet parse err', e);
        }
      });
    }
    start();
  };
})();
