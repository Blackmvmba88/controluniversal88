const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const SIMULATE = process.env.SIMULATE === '1' || process.env.SIMULATE === 'true';
const MAP_MODE = process.env.MAP === '1' || process.env.MAP === 'true';
let HID;
try { HID = require('node-hid'); } catch (e) { /* node-hid may be unavailable */ }

// A minimal, practical DS4 parser with interactive mapping support.
// It attempts a best-effort decode for common DS4 USB reports and
// emits normalized events: {type: 'button'|'axis', id: <string>, value: <number>}

const DEFAULT_MAP = {
  // axes: byte index (0-based) for usb reports (best-effort)
  axes: { lstick_x: 1, lstick_y: 2, rstick_x: 3, rstick_y: 4, l2: 8, r2: 9 },
  // buttons: describe (byteIndex, bitMask) for commonly found layout
  buttons: {
    // face buttons (example mapping, may vary by hardware/firmware)
    square: [5, 0x10],
    cross:  [5, 0x20],
    circle: [5, 0x40],
    triangle:[5,0x80],
    l1: [6, 0x01],
    r1: [6, 0x02],
    l2_btn: [6,0x04],
    r2_btn: [6,0x08],
    share: [6,0x10],
    options: [6,0x20],
    lstick: [6,0x40],
    rstick: [6,0x80],
    ps: [7,0x01]
  },
  dpad: { byte: 5, mask: 0x0f } // lower nibble 0..7 for direction
};

class Daemon extends EventEmitter {
  constructor() {
    super();
    this.mapping = this._loadMap();
    this.prevState = null;
    // Do not auto-start in constructor so tests can instantiate Daemon safely.
    // Call `start()` explicitly from the server entrypoint.
  }

  _loadMap() {
    try {
      const m = JSON.parse(fs.readFileSync(path.join(process.cwd(), '.ds4map.json'), 'utf8'));
      console.log('Loaded .ds4map.json mapping');
      return m;
    } catch (e) {
      return DEFAULT_MAP;
    }
  }

  start() {
    if (!SIMULATE && HID) {
      this._tryOpenDevice();
    } else {
      logger.info('Daemon: running in SIMULATE mode (set SIMULATE=0 to try using node-hid)');
      this._simulate();
    }
  }

  _tryOpenDevice() {
    try {
      const devices = HID.devices();
      logger.info('HID devices found:', devices.length);
      // Broad vendor/product detection: support Sony (DualShock) and common third-party controllers (PowerA / XBX / Xbox / generic Controller)
      const ds = devices.find(d => /Sony|PlayStation|Wireless Controller|PowerA|XBX|Xbox|Controller/i.test((d.manufacturer || '') + ' ' + (d.product || '')));
      if (!ds) {
        logger.warn('No supported controller found; falling back to simulation.');
        this._simulate();
        return;
      }
      logger.info('Attempting to open controller device:', ds);
      const device = new HID.HID(ds.path);
      this._device = device;
      device.on('data', buf => {
        try {
          this._handleBuffer(buf);
        } catch (err) {
          console.error('Error handling buffer:', err);
        }
      });
      device.on('error', err => {
        logger.error('HID error:', err);
        logger.info('Falling back to simulation.');
        this._simulate();
      });
    } catch (err) {
      console.error('Error opening HID device:', err);
      this._simulate();
    }
  }

  _handleBuffer(buf) {
    // Validate buffer and use Buffer for efficient byte access
    if (!buf || (typeof buf.length !== 'number') || buf.length === 0) return;
    const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
    const state = { raw: b };

    // maintain recent raw reports for heuristic detection (useful for Bluetooth variants)
    this._recent = this._recent || [];
    this._recent.push(Array.from(b));
    if (this._recent.length > 8) this._recent.shift();

    // helper to safely get a byte or null
    const getByte = (idx) => (typeof idx === 'number' && idx >= 0 && idx < b.length) ? b[idx] : null;

    // Parse axes by mapping indices (validate mapping entries)
    state.axes = {};
    const axesMap = this.mapping && this.mapping.axes ? this.mapping.axes : {};
    for (const [name, idx] of Object.entries(axesMap)) {
      const v = getByte(idx);
      if (typeof v === 'number') {
        // normalize 0..255 to -1..1 for sticks (approx)
        if (name.includes('stick')) state.axes[name] = (v - 128) / 127;
        else state.axes[name] = v / 255; // triggers 0..1
      }
    }

    // Parse dpad (common encoding: nibble 0..7)
    state.dpad = null;
    if (this.mapping && this.mapping.dpad) {
      const dCfg = this.mapping.dpad;
      const rawByte = getByte(dCfg.byte);
      if (rawByte !== null && typeof dCfg.mask === 'number') {
        const nibble = rawByte & dCfg.mask;
        const dirMap = {
          0: 'dpad_up', 1: 'dpad_up|dpad_right', 2:'dpad_right', 3:'dpad_down|dpad_right',
          4: 'dpad_down', 5:'dpad_down|dpad_left',6:'dpad_left',7:'dpad_left|dpad_up'
        };
        if (nibble in dirMap) state.dpad = dirMap[nibble];
      }
    }

    // Parse buttons by checking bit masks, validate masks and indices
    state.buttons = {};
    const btnMap = this.mapping && this.mapping.buttons ? this.mapping.buttons : {};
    for (const [name, pair] of Object.entries(btnMap)) {
      if (!Array.isArray(pair) || pair.length < 2) { state.buttons[name] = false; continue; }
      const [byteIdx, mask] = pair;
      const val = getByte(byteIdx);
      if (typeof val === 'number' && typeof mask === 'number') {
        state.buttons[name] = !!(val & mask);
        // If mapped byte didn't indicate a press, attempt heuristic detection only when
        // the mapped byte value did not change (both prev and cur are zero)
        if (!state.buttons[name] && this.prevState && this.prevState.raw) {
          const prevRaw = Array.from(this.prevState.raw);
          const curRaw = Array.from(b);
          const prevMappedVal = (this.prevState.raw && this.prevState.raw[byteIdx]) || 0;
          if (prevMappedVal === val && val === 0) {
            const { findSingleBitChange } = require('../server/auto_map_core');
            const single = findSingleBitChange(prevRaw, curRaw);
            if (single && ((single.xor & (mask || 0)) !== 0)) state.buttons[name] = true;
          }
        }
      } else {
        // Attempt heuristic when mapping points outside current report (Bluetooth variant)
        state.buttons[name] = false;
        if (this.prevState && this.prevState.raw) {
          // compute diffs between previous raw and current
          const prevRaw = Array.from(this.prevState.raw);
          const curRaw = Array.from(b);
          // try to find a single-bit change
          const { findSingleBitChange } = require('../server/auto_map_core');
          const single = findSingleBitChange(prevRaw, curRaw);
          if (single) {
            // if change matches mask, consider this a press
            if ((single.xor & (mask || 0)) !== 0) {
              state.buttons[name] = true;
            }
          }
        }
      }
    }

    // If previous exists, emit diffs
    if (!this.prevState) {
      // Emit initial state but be conservative: only emit axes and button presses that are true
      this.prevState = state;
      Object.entries(state.buttons).forEach(([k,v]) => { if (v) this.emit('input', { type: 'button', id: k, value: 1 }); });
      Object.entries(state.axes).forEach(([k,v]) => this.emit('input', { type: 'axis', id: k, value: Number(v.toFixed(2)) }));
      return;
    }

    if (MAP_MODE) {
      // Print byte-wise diffs for interactive mapping
      const diffs = [];
      for (let i=0;i<b.length;i++) if (b[i] !== this.prevState.raw[i]) diffs.push({ idx:i, before:this.prevState.raw[i], after:b[i] });
      if (diffs.length) console.log('Report diff:', diffs);
    }

    // Buttons changes
    for (const [name, pressed] of Object.entries(state.buttons)) {
      const prev = !!this.prevState.buttons[name];
      if (pressed !== prev) {
        this.emit('input', { type: 'button', id: name, value: pressed ? 1 : 0 });
      }
    }

    // D-Pad: emit as individual buttons
    if (state.dpad !== this.prevState.dpad) {
      // clear previous dpad bits
      ['dpad_up','dpad_down','dpad_left','dpad_right'].forEach(id => this.emit('input', { type: 'button', id, value: 0 }));
      if (state.dpad) state.dpad.split('|').forEach(id => this.emit('input', { type: 'button', id, value: 1 }));
    }

    // Axes thresholded updates
    for (const [name, v] of Object.entries(state.axes)) {
      let prevV = 0;
      if (this.prevState && this.prevState.axes) prevV = this.prevState.axes[name] || 0;
      if (Math.abs(v - prevV) > 0.05) {
        this.emit('input', { type: 'axis', id: name, value: Number(v.toFixed(2)) });
      }
    }

    // Heuristic: if axis mapping missing for a known axis name, try to infer most variable byte
    const axesMapMissing = this.mapping && this.mapping.axes ? this.mapping.axes : {};
    for (const [name, idx] of Object.entries(axesMapMissing)) {
      const v = getByte(idx);
      if (v === null && this._recent && this._recent.length >= 3) {
        const { findMostVariableByte } = require('../server/auto_map_core');
        const candidateIdx = findMostVariableByte(this._recent);
        if (typeof candidateIdx === 'number') {
          // emit approximate axis value
          const candVal = ( (this._recent[this._recent.length-1][candidateIdx] || 0) - 128) / 127;
          this.emit('input', { type: 'axis', id: name, value: Number(candVal.toFixed(2)) });
        }
      }
    }

    this.prevState = state;
  }

  // Status helpers used by UI/CLI
  getStatus() {
    const core = require('./auto_map_core');
    return {
      mapping: this.mapping,
      recentReports: this._recent || [],
      sensors: core.detectSensorCandidates(this._recent || [])
    };
  }

  saveMapping(mappingObj) {
    const outPath = path.join(process.cwd(), '.ds4map.json');
    try { if (fs.existsSync(outPath)) fs.copyFileSync(outPath, outPath + '.bak.' + Date.now()); } catch (e) {}
    fs.writeFileSync(outPath, JSON.stringify(mappingObj, null, 2));
    this.mapping = mappingObj;
  }

  _simulate() {
    // Emit occasional button presses/releases for development
    const buttons = Object.keys(this.mapping.buttons);
    setInterval(() => {
      const btn = buttons[Math.floor(Math.random() * buttons.length)];
      this.emit('input', { type: 'button', id: btn, value: 1 });
      setTimeout(() => this.emit('input', { type: 'button', id: btn, value: 0 }), 200 + Math.random() * 600);
    }, 400);

    // Simulate some axis movement occasionally
    setInterval(() => {
      this.emit('input', { type: 'axis', id: 'lstick_x', value: (Math.random() * 2 - 1).toFixed(2) });
      this.emit('input', { type: 'axis', id: 'lstick_y', value: (Math.random() * 2 - 1).toFixed(2) });
    }, 1000);
  }
}

const instance = new Daemon();
module.exports = instance;
module.exports.Daemon = Daemon;
