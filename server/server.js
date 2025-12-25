const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const daemon = require('./daemon');
const logger = require('./logger');
const core = require('./auto_map_core');
const validation = require('./validation');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 8080;

if (process.env.LOG_LEVEL) logger.setLevel(process.env.LOG_LEVEL);

app.use(express.static(path.join(__dirname, '..', 'web')));
app.use('/docs', express.static(path.join(__dirname, '..', 'docs')));

// Simple status API used by calibration UI and CLI
app.get('/api/status', (req, res) => {
  try { 
    const status = daemon.getStatus();
    // Validar que el status tiene la estructura esperada
    if (!status || typeof status !== 'object') {
      throw new Error('Invalid status structure from daemon');
    }
    res.json(status); 
  } catch (e) { 
    logger.error('Error getting status:', e.message);
    res.status(500).json({ error: String(e.message || e) }); 
  }
});

app.post('/api/save-map', express.json(), validation.validateMappingBody(), (req, res) => {
  try { 
    daemon.saveMapping(req.body); 
    res.json({ ok: true }); 
  } catch (e) { 
    logger.error('Error saving mapping:', e.message);
    res.status(500).json({ error: String(e.message || e) }); 
  }
});

// Collection job management
const collectLib = require('./collect_lib');
let currentJob = null;

app.post('/api/collect/start', express.json(), async (req, res) => {
  // Validar y sanitizar parámetros
  const paramValidation = validation.validateAndSanitizeCollectParams(req.body || {});
  if (!paramValidation.valid) {
    return res.status(400).json({ error: 'Validation failed', details: paramValidation.errors });
  }
  
  const { label, count, save } = paramValidation.sanitized;
  if (currentJob && currentJob.status === 'running') {
    return res.status(409).json({ error: 'job running' });
  }
  currentJob = { status: 'running', label, count, progress: [], result: null };
  // run in background
  (async ()=>{
    try{
      const mapping = await collectLib.collectSamples({ label, count, simulate: process.env.SIMULATE === '1', save }, (s)=>{
        currentJob.progress.push(s);
        if (typeof broadcast === 'function') broadcast({ type: 'collect_status', job: currentJob });
      });
      currentJob.result = mapping;
      if (save) {
        currentJob.saved = true;
      }
      currentJob.status = 'done';
    }catch(e){ currentJob.status = 'error'; currentJob.error = String(e); }
    if (typeof broadcast === 'function') broadcast({ type: 'collect_status', job: currentJob });
  })();
  res.json({ ok: true, job: currentJob });
});

app.get('/api/collect/status', (req, res) => { res.json(currentJob || { status: 'idle' }); });

app.post('/api/collect/auto', express.json(), async (req, res) => {
  const buttons = ['square','cross','circle','triangle','l1','r1','l2_btn','r2_btn','share','options','lstick','rstick','ps','dpad_up','dpad_right','dpad_down','dpad_left'];
  
  // Validar parámetros
  const per = req.body && req.body.count !== undefined ? Number(req.body.count) : 2;
  if (!validation.isNumberInRange(per, 1, 20)) {
    return res.status(400).json({ error: 'count debe ser un número entre 1 y 20' });
  }
  
  const saveMapping = validation.toBoolean(req.body && req.body.save, false);
  if (currentJob && currentJob.status === 'running') {
    return res.status(409).json({ error: 'job running' });
  }
  currentJob = { status: 'running', label: 'auto', count: per, progress: [], result: null };
  (async ()=>{
    const aggregated = [];
    for (const b of buttons){
      currentJob.progress.push({ step: 'starting', label: b });
      if (typeof broadcast === 'function') broadcast({ type: 'collect_status', job: currentJob });
      try{
        const mapping = await collectLib.collectSamples({ label: b, count: per, simulate: process.env.SIMULATE === '1', save: false }, (s)=>{
          currentJob.progress.push(Object.assign({ label: b }, s));
          if (typeof broadcast === 'function') broadcast({ type: 'collect_status', job: currentJob });
        });
        aggregated.push(mapping);
        currentJob.progress.push({ step: 'mapped', label: b, mapping });
        if (typeof broadcast === 'function') broadcast({ type: 'collect_status', job: currentJob });
      } catch(e){ currentJob.progress.push({ step:'error', label: b, error: String(e) }); }
    }
    // Merge aggregated mappings (simple merge: later overrides earlier)
    const final = { axes: {}, buttons: {}, dpad: { byte: null, mask: 15 } };
    for (const m of aggregated) { Object.assign(final.axes, m.axes || {}); Object.assign(final.buttons, m.buttons || {}); if (m.dpad && m.dpad.byte) final.dpad = m.dpad; }
    currentJob.result = final;
    // Validate using samples file if present
    const samplesPath = path.join(process.cwd(), '.ds4map.samples.json');
    let samples = [];
    try { if (fs.existsSync(samplesPath)) samples = JSON.parse(fs.readFileSync(samplesPath,'utf8')); } catch (e) { /* ignore */ }
    try {
      const validation = core.validateMapping(final, samples);
      currentJob.validation = validation;
      currentJob.progress.push({ step: 'validation', validation });
      if (saveMapping) {
        if (validation && validation.ok) {
          daemon.saveMapping(final);
          currentJob.saved = true;
        } else {
          currentJob.saved = false;
          currentJob.saveError = 'validation failed';
          // save failed mapping for inspection
          const failedPath = path.join(process.cwd(), `.ds4map.failed.${Date.now()}.json`);
          fs.writeFileSync(failedPath, JSON.stringify({ mapping: final, validation }, null, 2));
          currentJob.failedPath = failedPath;
        }
      }
    } catch(e) {
      currentJob.saveError = String(e);
      currentJob.saved = false;
    }
    currentJob.status = 'done';
    if (typeof broadcast === 'function') broadcast({ type: 'collect_status', job: currentJob });
  })();
  res.json({ ok: true, job: currentJob });
});

wss.on('connection', (ws) => {
  logger.info('WebSocket client connected');
  try { 
    ws.send(JSON.stringify({ type: 'info', msg: 'connected' })); 
  } catch (e) { 
    logger.warn('Failed to send initial message to new client:', e.message);
  }
});

function broadcast(msg) {
  // Validar mensaje
  if (!msg || typeof msg !== 'object') {
    logger.error('Attempt to broadcast invalid message');
    return;
  }
  
  let data;
  try { 
    data = JSON.stringify(msg); 
  } catch (e) { 
    logger.error('Failed to serialize message:', e.message); 
    return; 
  }
  
  // Contador de clientes activos para logging
  let activeClients = 0;
  let failedClients = 0;
  
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) {
      try { 
        c.send(data); 
        activeClients++;
      } catch (e) { 
        logger.warn('Client send failed:', e.message); 
        failedClients++;
        try { 
          c.terminate(); 
        } catch(terminateErr){
          logger.debug('Failed to terminate dead client:', terminateErr.message);
        }
      }
    }
  });
  
  // Log solo si hay debug habilitado para evitar spam
  if (logger.debug && failedClients > 0) {
    logger.debug(`Broadcast: ${activeClients} successful, ${failedClients} failed`);
  }
}

// Start daemon explicitly (constructor no longer auto-starts so tests can create instances)
try {
  if (typeof daemon.start === 'function') daemon.start();
} catch (e) { console.error('Failed to start daemon', e); }

daemon.on('input', (ev) => {
  // Normalize events if needed
  broadcast(ev);
});

server.listen(PORT, () => logger.info(`Server listening on http://localhost:${PORT}`));

process.on('SIGINT', () => process.exit());
