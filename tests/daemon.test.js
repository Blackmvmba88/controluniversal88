const assert = require('assert');
const mod = require('../server/daemon');
const DaemonClass = mod.Daemon;

function makeBuffer(len, changes) {
  const b = Buffer.alloc(len, 0);
  for (const [idx, val] of Object.entries(changes)) b[Number(idx)] = val;
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

function testButtonPressRelease() {
  const d = new DaemonClass(DEFAULT_MAP);
  const events = [];
  d.on('input', (m) => events.push(m));

  // initial state all zero
  d._handleBuffer(makeBuffer(12, {}));
  // press cross (byte 5 mask 0x20)
  d._handleBuffer(makeBuffer(12, { 5: 0x20 }));
  assert(events.some((e) => e.type === 'button' && e.id === 'cross' && e.value === 1));

  // release cross
  events.length = 0;
  d._handleBuffer(makeBuffer(12, { 5: 0x00 }));
  assert(events.some((e) => e.type === 'button' && e.id === 'cross' && e.value === 0));
}

function testAxisThreshold() {
  const d = new DaemonClass(DEFAULT_MAP);
  const events = [];
  d.on('input', (m) => events.push(m));

  // initial state - all zero
  d._handleBuffer(makeBuffer(12, {}));
  events.length = 0;

  // move significantly
  d._handleBuffer(makeBuffer(12, { 1: 200 }));
  assert(
    events.some((e) => e.type === 'axis' && e.id === 'lstick_x'),
    'Should have emitted lstick_x axis event'
  );
}

module.exports = { testButtonPressRelease, testAxisThreshold };
