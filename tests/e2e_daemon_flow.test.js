const assert = require('assert');
const Daemon = require('../server/daemon').Daemon;

function testDaemonE2EFlow() {
  const d = new Daemon();
  const events = [];
  d.on('input', e => events.push(e));
  // simulate two raw reports where byte 5 toggles face buttons and byte 2 varies (motion)
  const r0 = Buffer.from([0,128,10,0,0,0,0,0]);
  const r1 = Buffer.from([0,128,10,0,0,32,0,0]); // cross pressed
  const r2 = Buffer.from([0,200,120,0,0,64,0,0]); // motion and circle pressed
  d._handleBuffer(r0);
  d._handleBuffer(r1);
  d._handleBuffer(r2);
  // Expect at least one button event and at least one axis event emitted
  assert(events.some(e => e.type === 'button'));
  assert(events.some(e => e.type === 'axis'));
}

module.exports = { testDaemonE2EFlow };
