const http = require('http');
const fs = require('fs');

function postStart(label, count){
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ label, count });
    const req = http.request({ method:'POST', host:'localhost', port:8080, path:'/api/collect/start', headers: {'Content-Type':'application/json','Content-Length': Buffer.byteLength(data)} }, (res)=>{
      let body=''; res.on('data', d=>body+=d); res.on('end', ()=>resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.write(data); req.end();
  });
}

function getStatus(){
  return new Promise((resolve,reject)=>{
    http.get('http://localhost:8080/api/collect/status', (res)=>{
      let b=''; res.on('data', d=>b+=d); res.on('end', ()=>{ try{ resolve(JSON.parse(b)); } catch(e){ reject(e); } });
    }).on('error', reject);
  });
}

async function testCollectApi(){
  // start job
  await postStart('cross', 2);
  // poll
  const start = Date.now();
  while (Date.now() - start < 20000){
    const s = await getStatus();
    if (s && s.status === 'done') break;
    await new Promise(r=>setTimeout(r, 500));
  }
  // verify mapping file contains 'cross'
  const path = '.ds4map.json';
  if (!fs.existsSync(path)) throw new Error('.ds4map.json not found');
  const j = JSON.parse(fs.readFileSync(path,'utf8'));
  if (!j.buttons || !j.buttons.cross) throw new Error('cross not mapped');
}

module.exports = { testCollectApi };
