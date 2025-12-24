const http = require('http');

function testStatusApi() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:8080/api/status', (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', ()=>{
        try{
          const j = JSON.parse(body);
          if (!j || typeof j !== 'object') return reject(new Error('invalid json'));
          resolve();
        }catch(e){ reject(e); }
      });
    }).on('error', reject);
  });
}

module.exports = { testStatusApi };
