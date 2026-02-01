const WebSocket = require('ws');

function testWsBroadcast() {
  return new Promise((resolve, reject) => {
    const url = process.env.SERVER_URL || 'ws://localhost:8080';
    const c1 = new WebSocket(url);
    const c2 = new WebSocket(url);
    let ready = 0;
    const timer = setTimeout(() => {
      try {
        c1.terminate();
        c2.terminate();
      } catch (_) {}
      reject(new Error('timeout waiting for broadcast'));
    }, 3000);

    c1.on('open', () => {
      if (++ready === 2) doSend();
    });
    c2.on('open', () => {
      if (++ready === 2) doSend();
    });

    c2.on('message', (m) => {
      try {
        const msg = JSON.parse(m);
        if (msg && msg.type === 'test_ping' && msg.ok === true) {
          clearTimeout(timer);
          c1.close();
          c2.close();
          resolve();
        }
      } catch (e) {
        /* ignore */
      }
    });

    c1.on('error', (e) => {
      clearTimeout(timer);
      try {
        c1.close();
        c2.close();
      } catch (_) {}
      reject(e);
    });
    c2.on('error', (e) => {
      clearTimeout(timer);
      try {
        c1.close();
        c2.close();
      } catch (_) {}
      reject(e);
    });

    function doSend() {
      // send a simple JSON message that server should rebroadcast
      c1.send(JSON.stringify({ type: 'test_ping', ok: true }));
    }
  });
}

module.exports = { testWsBroadcast };
