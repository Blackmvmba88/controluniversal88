const WebSocket = require('ws');
const serverUrl = process.env.SERVER_URL || 'ws://localhost:8080';

(async ()=>{
  const client = new WebSocket(serverUrl);
  let seenButton = false;
  client.on('open', ()=> console.log('connected'));
  client.on('message', (m)=>{
    try{ const msg = JSON.parse(m.toString()); if (msg && msg.type === 'button'){ console.log('Got button', msg); seenButton = true; process.exit(0);} if (msg && msg.type === 'axis'){ console.log('Got axis', msg); seenButton = true; process.exit(0);} } catch(e){}
  });
  client.on('error', (e)=>{ console.error('error', e); process.exit(2); });
  setTimeout(()=>{ if (!seenButton) { console.error('timeout waiting for button/axis'); process.exit(3); } }, 8000);
})();