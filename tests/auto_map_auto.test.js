const assert = require('assert');
const core = require('../server/auto_map_core');

// Simulate deterministic sequences of reports per button and ensure mapping is inferred
function testAutoMapperInfer() {
  // Simulated previous report and press report where byte 6 toggles bit 0x02 (r1)
  const prev = [0, 0, 0, 0, 0, 0, 0, 0];
  const press = prev.slice();
  press[6] = 0x02;
  const diffs = core.printDiff(prev, press);
  const cand = core.chooseCandidateFromDiffs(diffs);
  assert(cand && cand.idx === 6 && cand.xor === 2);

  // multiple attempts for same button
  const attempts = [diffs, [{ idx: 6, before: 0, after: 2, xor: 2 }]];
  const mapping = core.inferButtonMappings({ r1: attempts });
  assert(mapping.r1[0] === 6 && mapping.r1[1] === 2);
}

function testFindMostVariableByte() {
  const reports = [
    [0, 0, 0, 0],
    [0, 32, 0, 0],
    [0, 64, 0, 0],
    [0, 0, 0, 0],
  ];
  const idx = core.findMostVariableByte(reports);
  assert.strictEqual(idx, 1);
}

module.exports = { testAutoMapperInfer, testFindMostVariableByte };
