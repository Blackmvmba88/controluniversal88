const http = require('http');
const fs = require('fs');

function postAuto(count){
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ count });
    const req = http.request({ method:'POST', host:'localhost', port:8080, path:'/api/collect/auto', headers: {'Content-Type':'application/json','Content-Length': Buffer.byteLength(data)} }, (res)=>{
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

async function testCollectPreview(){
  await postAuto(2);
  const start = Date.now();
  let job;
  while (Date.now() - start < 20000){
    job = await getStatus();
    if (job && job.status === 'done') break;
    await new Promise(r=>setTimeout(r, 500));
  }
  if (!job || job.status !== 'done') throw new Error('job did not finish');
  if (!job.result || !job.result.buttons) throw new Error('no result mapping in preview');
  // ensure file not saved yet
  if (fs.existsSync('.ds4map.json')){
    throw new Error('.ds4map.json should not be saved during preview');
  }
  // now commit via save endpoint
  await new Promise((resolve,reject)=>{
    const data = JSON.stringify(job.result);
    const req = http.request({ method:'POST', host:'localhost', port:8080, path:'/api/save-map', headers: {'Content-Type':'application/json','Content-Length': Buffer.byteLength(data)} }, (res)=>{ res.on('data',()=>{}); res.on('end', resolve); });
    req.on('error', reject);
    req.write(data); req.end();
  });
  if (!fs.existsSync('.ds4map.json')) throw new Error('save failed');
}

module.exports = { testCollectPreview };
