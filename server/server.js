const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const daemon = require('./daemon');
const logger = require('./logger');
const core = require('./auto_map_core');
const validation = require('./validation');
const middleware = require('./middleware');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 8080;

if (process.env.LOG_LEVEL) logger.setLevel(process.env.LOG_LEVEL);

// Aplicar middlewares globales
app.use(middleware.requestLogger());
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

// Aplicar rate limiting a endpoints de colección (más estricto)
const collectRateLimit = middleware.rateLimiter({ 
  windowMs: 60000, // 1 minuto
  maxRequests: 20   // Máximo 20 requests por minuto
});

app.post('/api/collect/start', express.json(), collectRateLimit, async (req, res) => {
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
  (async () => {
    try {
      const mapping = await collectLib.collectSamples(
        { label, count, simulate: process.env.SIMULATE === '1', save },
        (s) => {
          currentJob.progress.push(s);
          if (typeof broadcast === 'function')
            broadcast({ type: 'collect_status', job: currentJob });
        }
      );
      currentJob.result = mapping;
      if (save) {
        currentJob.saved = true;
      }
      currentJob.status = 'done';
    } catch (e) {
      currentJob.status = 'error';
      currentJob.error = String(e);
    }
    if (typeof broadcast === 'function') broadcast({ type: 'collect_status', job: currentJob });
  })();
  res.json({ ok: true, job: currentJob });
});

// Generate bookmarklet for a given remote URL (used by CI to auto-generate bookmarklets for tunnels)
app.post('/api/bookmarklet', express.json(), (req, res) => {
  try {
    const url = (req.body && req.body.url) || req.query.url || process.env.TUNNEL_URL || null;
    if (!url) return res.status(400).json({ error: 'url required' });
    // basic validation
    if (!/^https?:\/\//.test(url) && !/^wss?:\/\//.test(url))
      return res.status(400).json({ error: 'invalid url' });
    // host for loading the bookmarklet script
    const host = url
      .replace(/^https?:\/\//, '')
      .replace(/^wss?:\/\//, '')
      .replace(/\/$/, '');
    const bookmarklet = `javascript:(function(){var s=document.createElement('script');s.src='https://${host}/bookmarklet.js';document.head.appendChild(s);setTimeout(function(){connectToController('${url}')},200);})();`;

    // Persist as short-lived file in dist with SHA and expiry (24h)
    try {
      const fs = require('fs');
      const crypto = require('crypto');
      fs.mkdirSync('dist', { recursive: true });
      const sha = crypto.createHash('sha256').update(bookmarklet).digest('hex').slice(0, 12);
      const expires = Date.now() + 24 * 60 * 60 * 1000; // 24h
      const filename = `bookmarklet_${sha}.txt`;
      const meta = { url, sha, expires };
      fs.writeFileSync(require('path').join('dist', filename), bookmarklet);
      fs.writeFileSync(require('path').join('dist', `${filename}.meta.json`), JSON.stringify(meta));
      const fileUrl = `${req.protocol}://${req.get('host')}/dist/${filename}`;
      // create a short access token (uuid-lite)
      const token = require('crypto').randomBytes(6).toString('hex');
      // accept optional pr and author from CI to restrict token to PR author (for auditing)
      const pr = (req.body && req.body.pr) || (req.query && req.query.pr) || null;
      const author = (req.body && req.body.author) || (req.query && req.query.author) || null;
      // allow optional TTL override (bounded). Default TTL lowered to 4 hours for safety.
      const ttlHours = Math.min(
        Number((req.body && req.body.ttl_hours) || process.env.BOOKMARKLET_TTL_HOURS || 4),
        168
      );
      const expiresFinal = Date.now() + Number(ttlHours) * 60 * 60 * 1000;
      const tokenMeta = { sha, token, expires: expiresFinal, pr, author };
      // store token meta file for validation
      fs.writeFileSync(path.join('dist', `${filename}.token.json`), JSON.stringify(tokenMeta));

      res.json({
        ok: true,
        url,
        bookmarklet,
        fileUrl: `${fileUrl}?token=${token}`,
        sha,
        expires: expiresFinal,
        token,
        pr,
        author,
      });
    } catch (e) {
      console.warn('Failed to persist bookmarklet', e);
      res.json({ ok: true, url, bookmarklet });
    }
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Serve persisted bookmarklet file but require token validation
app.get('/dist/:file', (req, res, next) => {
  try {
    const file = req.params.file;
    if (!file || !file.startsWith('bookmarklet_') || !file.endsWith('.txt')) return next();
    const token = req.query.token;
    if (!token) return res.status(403).send('token required');
    const sha = file.slice('bookmarklet_'.length, -'.txt'.length);
    const metaPath = path.join(process.cwd(), 'dist', `bookmarklet_${sha}.txt.token.json`);
    if (!fs.existsSync(metaPath)) return res.status(404).send('not found');
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    if (meta.token !== token) return res.status(403).send('invalid token');
    if (Date.now() > meta.expires) return res.status(410).send('expired');
    // serve file
    return res.sendFile(path.join(process.cwd(), 'dist', file));
  } catch (e) {
    console.warn('dist serve err', e);
    return res.status(500).send('err');
  }
});

// Status endpoint for a persisted bookmarklet (returns meta or 404)
app.get('/api/bookmarklet/status', (req, res) => {
  const sha = req.query.sha;
  if (!sha) return res.status(400).json({ error: 'sha required' });
  try {
    const p = require('path').join(process.cwd(), 'dist', `bookmarklet_${sha}.txt.meta.json`);
    if (!require('fs').existsSync(p)) return res.status(404).json({ error: 'not found' });
    const m = JSON.parse(require('fs').readFileSync(p, 'utf8'));
    // check expiry
    if (Date.now() > m.expires) return res.status(410).json({ error: 'expired' });
    res.json({ ok: true, meta: m });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// verify token & return associated metadata (author/pr) without serving file
app.get('/api/bookmarklet/verify', (req, res) => {
  const sha = req.query.sha;
  const token = req.query.token;
  if (!sha || !token) return res.status(400).json({ error: 'sha and token required' });
  try {
    const p = require('path').join(process.cwd(), 'dist', `bookmarklet_${sha}.txt.token.json`);
    if (!require('fs').existsSync(p)) return res.status(404).json({ error: 'not found' });
    const meta = JSON.parse(require('fs').readFileSync(p, 'utf8'));
    if (meta.token !== token) return res.status(403).json({ error: 'invalid token' });
    if (Date.now() > meta.expires) return res.status(410).json({ error: 'expired' });
    res.json({ ok: true, meta: { pr: meta.pr, author: meta.author, expires: meta.expires } });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/bookmarklet', (req, res) => {
  const url = req.query.url || process.env.TUNNEL_URL || null;
  if (!url) return res.status(400).json({ error: 'url required' });
  const host = url
    .replace(/^https?:\/\//, '')
    .replace(/^wss?:\/\//, '')
    .replace(/\/$/, '');
  const bookmarklet = `javascript:(function(){var s=document.createElement('script');s.src='https://${host}/bookmarklet.js';document.head.appendChild(s);setTimeout(function(){connectToController('${url}')},200);})();`;
  res.json({ ok: true, url, bookmarklet });
});

// Serve plain-text bookmarklet at /bookmarklet.txt?url=<encoded_url>
app.get('/bookmarklet.txt', (req, res) => {
  const url = req.query.url || process.env.TUNNEL_URL || null;
  if (!url) return res.status(400).send('url required');
  const host = url
    .replace(/^https?:\/\//, '')
    .replace(/^wss?:\/\//, '')
    .replace(/\/$/, '');
  const bookmarklet = `javascript:(function(){var s=document.createElement('script');s.src='https://${host}/bookmarklet.js';document.head.appendChild(s);setTimeout(function(){connectToController('${url}')},200);})();`;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(bookmarklet);
});

// Serve dist folder (bookmarklet artifacts) as static if present
app.use('/dist', express.static(path.join(__dirname, '..', 'dist')));

app.get('/api/collect/status', (req, res) => {
  res.json(currentJob || { status: 'idle' });
});

app.post('/api/collect/auto', express.json(), collectRateLimit, async (req, res) => {
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
  (async () => {
    const aggregated = [];
    for (const b of buttons) {
      currentJob.progress.push({ step: 'starting', label: b });
      if (typeof broadcast === 'function') broadcast({ type: 'collect_status', job: currentJob });
      try {
        const mapping = await collectLib.collectSamples(
          { label: b, count: per, simulate: process.env.SIMULATE === '1', save: false },
          (s) => {
            currentJob.progress.push(Object.assign({ label: b }, s));
            if (typeof broadcast === 'function')
              broadcast({ type: 'collect_status', job: currentJob });
          }
        );
        aggregated.push(mapping);
        currentJob.progress.push({ step: 'mapped', label: b, mapping });
        if (typeof broadcast === 'function') broadcast({ type: 'collect_status', job: currentJob });
      } catch (e) {
        currentJob.progress.push({ step: 'error', label: b, error: String(e) });
      }
    }
    // Merge aggregated mappings (simple merge: later overrides earlier)
    const final = { axes: {}, buttons: {}, dpad: { byte: null, mask: 15 } };
    for (const m of aggregated) {
      Object.assign(final.axes, m.axes || {});
      Object.assign(final.buttons, m.buttons || {});
      if (m.dpad && m.dpad.byte) final.dpad = m.dpad;
    }
    currentJob.result = final;
    // Validate using samples file if present
    const samplesPath = path.join(process.cwd(), '.ds4map.samples.json');
    let samples = [];
    try {
      if (fs.existsSync(samplesPath)) samples = JSON.parse(fs.readFileSync(samplesPath, 'utf8'));
    } catch (e) {
      /* ignore */
    }
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
    } catch (e) {
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
} catch (e) {
  console.error('Failed to start daemon', e);
}

daemon.on('input', (ev) => {
  // Normalize events if needed
  broadcast(ev);
});

server.listen(PORT, () => logger.info(`Server listening on http://localhost:${PORT}`));

// Aplicar middleware de manejo de errores (debe ir al final)
app.use(middleware.errorHandler());

process.on('SIGINT', () => process.exit());
