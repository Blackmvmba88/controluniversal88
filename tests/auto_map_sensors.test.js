const assert = require('assert');
const core = require('../server/auto_map_core');

function testDetectSensorCandidates() {
  // create reports where byte 2 varies widely (motion), byte 8 is mostly constant ~50 (battery)
  const reports = [];
  for (let i = 0; i < 10; i++) {
    const r = [0, 0, 0, 0, 0, 0, 0, 0, 50, 0];
    r[2] = i * 10;
    reports.push(r);
  }
  const c = core.detectSensorCandidates(reports);
  assert(c.motionCandidates.includes(2));
  assert(c.batteryCandidates.includes(8));
}

module.exports = { testDetectSensorCandidates };
