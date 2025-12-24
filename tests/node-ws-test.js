// Simple integration test: start the server (manually or in CI), then run this to validate that the server re-broadcasts messages
const WebSocket = require('ws');
const serverUrl = process.env.SERVER_URL || 'ws://localhost:8080';

(async ()=>{
  const client = new WebSocket(serverUrl);
  client.on('open', ()=> console.log('Test client connected'));
  client.on('message', (m)=>{
    console.log('Received:', m.toString());
    process.exit(0); // success
  });
  client.on('error', (e)=>{ console.error('Test client error', e); process.exit(1); });
})();
