const assert = require('assert');
const mod = require('../server/daemon');
const DaemonClass = mod.Daemon;

function makeBuffer(len, changes) {
  const b = Buffer.alloc(len, 0);
  for (const [idx, val] of Object.entries(changes)) b[Number(idx)] = val;
  return b;
}

function testButtonPressRelease() {
  const d = new DaemonClass();
  const events = [];
  d.on('input', (m) => events.push(m));

  // initial state all zero
  d._handleBuffer(makeBuffer(12, {}));
  // press cross (byte 5 mask 0x20)
  d._handleBuffer(makeBuffer(12, {5: 0x20}));
  assert(events.some(e => e.type === 'button' && e.id === 'cross' && e.value === 1));

  // release cross
  events.length = 0;
  d._handleBuffer(makeBuffer(12, {5: 0x00}));
  assert(events.some(e => e.type === 'button' && e.id === 'cross' && e.value === 0));
}

function testAxisThreshold() {
  const d = new DaemonClass();
  const events = [];
  d.on('input', (m) => events.push(m));

  // initial center
  d._handleBuffer(makeBuffer(12, {1:128}));
  events.length = 0;
  // move to right significantly
  d._handleBuffer(makeBuffer(12, {1:200}));
  assert(events.some(e => e.type === 'axis' && e.id === 'lstick_x'));
}

module.exports = { testButtonPressRelease, testAxisThreshold };
