const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const daemon = require('./daemon');
const logger = require('./logger');
const core = require('./auto_map_core');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 8080;

if (process.env.LOG_LEVEL) logger.setLevel(process.env.LOG_LEVEL);

app.use(express.static(path.join(__dirname, '..', 'web')));

// Simple status API used by calibration UI and CLI
app.get('/api/status', (req, res) => {
  try {
    res.json(daemon.getStatus());
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/api/save-map', express.json(), (req, res) => {
  try {
    daemon.saveMapping(req.body);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Collection job management
const collectLib = require('./collect_lib');
let currentJob = null;

app.post('/api/collect/start', express.json(), async (req, res) => {
  const label = req.body && req.body.label;
  const count = (req.body && Number(req.body.count)) || 3;
  const save = !!(req.body && req.body.save);
  if (!label) return res.status(400).json({ error: 'label required' });
  if (currentJob && currentJob.status === 'running')
    return res.status(409).json({ error: 'job running' });
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

app.post('/api/collect/auto', express.json(), async (req, res) => {
  const buttons = [
    'square',
    'cross',
    'circle',
    'triangle',
    'l1',
    'r1',
    'l2_btn',
    'r2_btn',
    'share',
    'options',
    'lstick',
    'rstick',
    'ps',
    'dpad_up',
    'dpad_right',
    'dpad_down',
    'dpad_left',
  ];
  const per = (req.body && Number(req.body.count)) || 2;
  const saveMapping = !!(req.body && req.body.save);
  if (currentJob && currentJob.status === 'running')
    return res.status(409).json({ error: 'job running' });
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
    /* ignore */
  }

  // Rebroadcast messages received from one client to all connected clients.
  // This allows keyboard clients (web/client_keyboard.js) to send 'axis' and 'button'
  // messages which are then reflected in monitor UIs.
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      logger.info('WS recv', msg && msg.type ? msg.type : 'unknown');
      if (msg && typeof msg.type === 'string') {
        broadcast(msg);
      }
    } catch (e) {
      logger.warn('WS parse failed', String(e));
    }
  });
});

function broadcast(msg) {
  let data;
  try {
    data = JSON.stringify(msg);
  } catch (e) {
    console.error('Failed to serialize message', e);
    return;
  }
  logger.info('Broadcasting', msg && msg.type ? msg.type : 'unknown');
  const toRemove = [];
  wss.clients.forEach((c) => {
    if (c.readyState === WebSocket.OPEN) {
      try {
        c.send(data);
      } catch (e) {
        logger.warn('Client send failed, closing client', String(e));
        try {
          c.terminate();
        } catch (_) {}
      }
    }
  });
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

process.on('SIGINT', () => process.exit());
