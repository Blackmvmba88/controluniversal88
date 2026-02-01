const assert = require('assert');
const core = require('../server/auto_map_core');

function testPrintDiff() {
  const prev = [0, 0, 0, 0];
  const cur = [0, 32, 0, 0];
  const diffs = core.printDiff(prev, cur);
  assert.strictEqual(diffs.length, 1);
  assert.deepStrictEqual(diffs[0], { idx: 1, before: 0, after: 32, xor: 32 });
}

function testChooseCandidateSingleBit() {
  const diffs = [
    { idx: 5, before: 0, after: 16, xor: 16 },
    { idx: 6, before: 0, after: 3, xor: 3 },
  ];
  const c = core.chooseCandidateFromDiffs(diffs);
  assert.strictEqual(c.idx, 5);
  assert.strictEqual(c.xor, 16);
}

function testInferButtonMappings() {
  const btnDiffs = {
    cross: [[{ idx: 5, before: 0, after: 32, xor: 32 }]],
    circle: [[{ idx: 5, before: 0, after: 64, xor: 64 }]],
    square: [[{ idx: 5, before: 0, after: 16, xor: 16 }]],
  };
  const mapping = core.inferButtonMappings(btnDiffs);
  assert.strictEqual(mapping.cross[0], 5);
  assert.strictEqual(mapping.cross[1], 32);
  assert.strictEqual(mapping.circle[1], 64);
  assert.strictEqual(mapping.square[1], 16);
}

function testInferDpadByte() {
  const dpadDiffsArray = [
    [{ idx: 4, before: 0, after: 1, xor: 1 }],
    [{ idx: 4, before: 1, after: 2, xor: 3 }],
    [{ idx: 4, before: 2, after: 4, xor: 6 }],
  ];
  const r = core.inferDpadByte(dpadDiffsArray);
  assert.strictEqual(r.byte, 4);
  assert.strictEqual(r.mask, 0x0f);
}

module.exports = {
  testPrintDiff,
  testChooseCandidateSingleBit,
  testInferButtonMappings,
  testInferDpadByte,
};
