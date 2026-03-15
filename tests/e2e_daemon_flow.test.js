const assert = require('assert');
const Daemon = require('../server/daemon').Daemon;

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

function testDaemonE2EFlow() {
  const d = new Daemon(DEFAULT_MAP);
  const events = [];
  d.on('input', (e) => events.push(e));

  // ensure initial state (all zero)
  d._handleBuffer(Buffer.alloc(12, 0));
  events.length = 0;

  // r1: move axis significantly (200) and press cross (32)
  const r1 = Buffer.from([0, 200, 10, 0, 0, 32, 0, 0, 0, 0, 0, 0]);
  d._handleBuffer(r1);
  assert(
    events.some((e) => e.type === 'button' && e.id === 'cross'),
    'Should have emitted cross press'
  );
  assert(
    events.some((e) => e.type === 'axis' && e.id === 'lstick_x'),
    'Should have emitted lstick_x axis event for 200'
  );

  events.length = 0;
  // r2: release cross (0) and press circle (64)
  const r2 = Buffer.from([0, 200, 120, 0, 0, 64, 0, 0, 0, 0, 0, 0]);
  d._handleBuffer(r2);

  assert(
    events.some((e) => e.type === 'button' && e.id === 'circle'),
    'Should have emitted circle press'
  );
}

module.exports = { testDaemonE2EFlow };
