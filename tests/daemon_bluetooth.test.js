const assert = require('assert');
const Daemon = require('../server/daemon').Daemon;

function makeReport(len, changes) {
  const b = Buffer.alloc(len, 0);
  for (const [k, v] of Object.entries(changes)) b[Number(k)] = v;
  return b;
}

const DEFAULT_MAP = {
  axes: { lstick_x: 1, lstick_y: 2, rstick_x: 3, rstick_y: 4, l2: 8, r2: 9 },
  buttons: {
    square: [5, 0x10],
    cross: [5, 0x20],
    circle: [5, 0x40],
    triangle: [5, 0x80],
    l1: [6, 0x01],
    r1: [6, 0x02],
    l2_btn: [6, 0x04],
    r2_btn: [6, 0x08],
    share: [6, 0x10],
    options: [6, 0x20],
    lstick: [6, 0x40],
    rstick: [6, 0x80],
    ps: [7, 0x01],
  },
  dpad: { byte: 5, mask: 0x0f },
};

function testBluetoothButtonHeuristic() {
  const d = new Daemon(DEFAULT_MAP);
  const events = [];
  d.on('input', (m) => events.push(m));

  // initial state - empty
  d._handleBuffer(Buffer.alloc(8, 0));
  events.length = 0;

  // now a Bluetooth report with different layout where byte 10 toggles bit 0x20 for cross
  // We use a longer buffer (12 bytes) but mapping for buttons is at byte 5 and 6, which are present.
  // The heuristic triggers if mapping points to a byte NOT in current buffer, OR if byte is 0 and didn't change.
  // Let's force it by using a very short buffer first then a longer one.
  d._handleBuffer(Buffer.alloc(4, 0)); // buttons at 5,6 are NULL now
  d._handleBuffer(makeReport(12, { 10: 0x20 }));
  assert(events.some((e) => e.type === 'button' && e.id === 'cross'));
}

function testBluetoothAxisHeuristic() {
  const d = new Daemon(DEFAULT_MAP);
  const events = [];
  d.on('input', (m) => events.push(m));

  // initial state - empty 1-byte buffer so index 1 (lstick_x) is NULL
  d._handleBuffer(Buffer.from([0]));
  events.length = 0;

  // simulate varied reports where the most variable byte is index 7
  d._handleBuffer(makeReport(12, { 7: 128 }));
  d._handleBuffer(makeReport(12, { 7: 200 }));
  d._handleBuffer(makeReport(12, { 7: 50 }));

  // trigger an update where mapping index for lstick_x is missing (buffer too short)
  // this triggers heuristic
  d._handleBuffer(Buffer.from([0]));

  assert(
    events.some((e) => e.type === 'axis' && e.id === 'lstick_x'),
    'Should have emitted lstick_x axis event via heuristic'
  );
}

module.exports = { testBluetoothButtonHeuristic, testBluetoothAxisHeuristic };
