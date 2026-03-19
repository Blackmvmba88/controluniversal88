const fs = require('fs');
const path = require('path');
const core = require('./auto_map_core');
const utils = require('./auto_map_utils');

const DEFAULT_MAP = require('./daemon').mapping || null;
const FALLBACK_BUTTON_MAP = {
  cross: [5, 0x20],
  circle: [5, 0x40],
  square: [5, 0x10],
  triangle: [5, 0x80],
};

function readJsonArray(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function appendSamples(filePath, pairs) {
  const existing = readJsonArray(filePath);
  existing.push(...pairs);
  fs.writeFileSync(filePath, JSON.stringify(existing, null, 2));
  return existing;
}

async function collectSamples(
  { label, count = 3, timeout = 8000, simulate = process.env.SIMULATE === '1', save = true },
  progressCb = () => {}
) {
  // returns mapping delta (object)
  const samplesPath = path.join(process.cwd(), '.ds4map.samples.json');
  const pairs = [];
  if (simulate) {
    // deterministic simulation using default mapping if available, else use byte 5 mask 0x20 for cross
    const simMap = DEFAULT_MAP && DEFAULT_MAP.buttons ? DEFAULT_MAP.buttons : FALLBACK_BUTTON_MAP;
    const [byteIdx, mask] = simMap[label] || [5, 0x20];
    for (let i = 0; i < count; i++) {
      const before = Array.from({ length: Math.max(8, byteIdx + 1) }, () => 0);
      const after = before.slice();
      after[byteIdx] = mask;
      pairs.push({ label, before, after });
      progressCb({ step: 'collected', i: i + 1, total: count });
    }
  } else {
    // Real device path - simplistic: read immediate report for 'before' and wait for changed report for 'after'
    // To keep function non-blocking, require caller to provide device access or spawn the read logic externally.
    throw new Error(
      'Non-simulated collection not implemented in collect_lib; use collect_samples.js or ensure device is accessible.'
    );
  }

  const existing = appendSamples(samplesPath, pairs);

  progressCb({ step: 'inferring' });
  const inferredButtons = core.inferMappingsFromLabeledReports(
    existing.map((p) => ({ label: p.label, before: p.before, after: p.after }))
  );

  // Build full mapping object
  const fullMapping = { axes: {}, buttons: inferredButtons, dpad: { byte: null, mask: 15 } };

  // Validate mapping against samples
  progressCb({ step: 'validating' });
  const validation = core.validateMapping(fullMapping, existing);
  progressCb({ step: 'validation_result', validation });

  // Save mapping with backup only if save === true AND validation.ok === true
  if (save) {
    try {
      if (validation && validation.ok) {
        utils.saveMappingWithBackup(fullMapping);
        fullMapping._saved = true;
      } else {
        // persist failed mapping for inspection
        const failedPath = path.join(process.cwd(), '.ds4map.failed.' + Date.now() + '.json');
        fs.writeFileSync(failedPath, JSON.stringify({ mapping: fullMapping, validation }, null, 2));
        fullMapping._saved = false;
        fullMapping._failedPath = failedPath;
      }
    } catch (e) {
      fullMapping._saved = false;
      fullMapping._saveError = e.message || String(e);
    }
  }

  // attach validation info
  fullMapping._validation = validation;
  progressCb({ step: 'done', mapping: fullMapping });
  return fullMapping;
}

module.exports = { collectSamples };
