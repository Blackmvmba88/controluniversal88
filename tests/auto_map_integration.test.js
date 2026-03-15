const assert = require('assert');
const core = require('../server/auto_map_core');

function testInferMappingsFromLabeledReports() {
  // Simulate two presses for cross (byte 5 toggles 0x20) and circle (byte5 toggles 0x40)
  const labeled = [
    { label: 'cross', before: [0, 0, 0, 0, 0, 0, 0], after: [0, 0, 0, 0, 0, 32, 0] },
    { label: 'cross', before: [0, 0, 0, 0, 0, 0, 0], after: [0, 0, 0, 0, 0, 32, 0] },
    { label: 'circle', before: [0, 0, 0, 0, 0, 0, 0], after: [0, 0, 0, 0, 0, 64, 0] },
    { label: 'square', before: [0, 0, 0, 0, 0, 0, 0], after: [0, 0, 0, 0, 0, 16, 0] },
  ];
  const mapping = core.inferMappingsFromLabeledReports(labeled);
  assert(mapping.cross && mapping.cross[0] === 5 && mapping.cross[1] === 32);
  assert(mapping.circle && mapping.circle[1] === 64);
  assert(mapping.square && mapping.square[1] === 16);
}

module.exports = { testInferMappingsFromLabeledReports };
