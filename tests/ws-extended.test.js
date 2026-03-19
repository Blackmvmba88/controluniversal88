const WebSocket = require('ws');
const { getServerUrl } = require('./test_urls');

function testWsExtendedReceivesInputEvents() {
  return new Promise((resolve, reject) => {
    const client = new WebSocket(getServerUrl());
    const timer = setTimeout(() => {
      try {
        client.terminate();
      } catch (e) {}
      reject(new Error('timeout waiting for button/axis'));
    }, 8000);

    client.on('message', (m) => {
      try {
        const msg = JSON.parse(m.toString());
        if (msg && (msg.type === 'button' || msg.type === 'axis')) {
          clearTimeout(timer);
          client.close();
          resolve();
        }
      } catch (e) {}
    });

    client.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}

module.exports = { testWsExtendedReceivesInputEvents };
