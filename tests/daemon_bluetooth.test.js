const assert = require('assert');
const Daemon = require('../server/daemon').Daemon;

function makeReport(len, changes) {
  const b = Buffer.alloc(len, 0);
  for (const [k, v] of Object.entries(changes)) b[Number(k)] = v;
  return b;
}

function testBluetoothButtonHeuristic() {
  const d = new Daemon();
  const events = [];
  d.on('input', (m) => events.push(m));
  // initial report (short USB-like)
  d._handleBuffer(makeReport(8, { 5: 0x00 }));
  // now a Bluetooth report with different layout where byte 10 toggles bit 0x20 for cross
  d._handleBuffer(makeReport(12, { 10: 0x20 }));
  // because mapping pointed to byte 5 which wasn't present, heuristic should detect a single-bit change and emit
  assert(events.some((e) => e.type === 'button' && e.id === 'cross'));
}

function testBluetoothAxisHeuristic() {
  const d = new Daemon();
  const events = [];
  d.on('input', (m) => events.push(m));
  // simulate varied reports where the most variable byte is index 7
  d._handleBuffer(makeReport(12, { 7: 128 }));
  d._handleBuffer(makeReport(12, { 7: 200 }));
  d._handleBuffer(makeReport(12, { 7: 100 }));
  // trigger an update where mapping index for lstick_x is missing (e.g., mapped to index 1 but buffer different), heuristic will emit approximate axis
  assert(events.some((e) => e.type === 'axis' && e.id === 'lstick_x'));
}

module.exports = { testBluetoothButtonHeuristic, testBluetoothAxisHeuristic };
