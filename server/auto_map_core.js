// Core logic extracted for testing from auto_map.js
function printDiff(prev, cur) {
  const diffs = [];
  const len = Math.max(prev.length, cur.length);
  for (let i = 0; i < len; i++) {
    const a = prev[i] || 0;
    const b = cur[i] || 0;
    if (a !== b) diffs.push({ idx: i, before: a, after: b, xor: a ^ b });
  }
  return diffs;
}

function chooseCandidateFromDiffs(diffs) {
  if (!diffs || diffs.length === 0) return null;
  // prefer diffs whose xor is a single bit
  for (const d of diffs) {
    if ((d.xor & (d.xor - 1)) === 0) return { idx: d.idx, xor: d.xor };
  }
  // else return the diff with smallest number of bits set
  let best = diffs[0];
  let pop = (x) => x.toString(2).replace(/0/g, '').length;
  let bestCount = pop(best.xor);
  for (const d of diffs.slice(1)) {
    const c = pop(d.xor);
    if (c < bestCount) {
      best = d;
      bestCount = c;
    }
  }
  return { idx: best.idx, xor: best.xor };
}

function inferButtonMappings(observedDiffsByButton) {
  // observedDiffsByButton: { buttonName: [ [diffs...], [diffs...] ] }
  const mapping = {};
  for (const [btn, attempts] of Object.entries(observedDiffsByButton)) {
    // flatten diffs of this button across attempts
    const candidates = [];
    for (const diffs of attempts) {
      for (const d of diffs) candidates.push(d);
    }
    const choice = chooseCandidateFromDiffs(candidates);
    if (choice) mapping[btn] = [choice.idx, choice.xor];
  }
  return mapping;
}

function inferDpadByte(dpadDiffsArray) {
  // dpadDiffsArray: array of diffs arrays for each dpad press
  const counts = {};
  for (const diffs of dpadDiffsArray) {
    for (const d of diffs) {
      counts[d.idx] = (counts[d.idx] || 0) + 1;
    }
  }
  // pick most frequent idx
  let bestIdx = null;
  let bestCount = 0;
  for (const [k, v] of Object.entries(counts)) {
    const vi = Number(k);
    if (v > bestCount) {
      bestIdx = vi;
      bestCount = v;
    }
  }
  if (bestIdx === null) return null;
  return { byte: bestIdx, mask: 0x0f };
}

function findSingleBitChange(prev, cur) {
  // return { idx, xor } or null
  const diffs = printDiff(prev, cur);
  for (const d of diffs) {
    if ((d.xor & (d.xor - 1)) === 0) return { idx: d.idx, xor: d.xor };
  }
  return null;
}

function findMostVariableByte(reports) {
  // reports: array of byte arrays
  if (!reports || reports.length === 0) return null;
  const len = Math.max(...reports.map((r) => r.length));
  const variances = new Array(len).fill(0);
  for (let i = 0; i < len; i++) {
    const vals = reports.map((r) => (i < r.length ? r[i] : 0));
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const varsum = vals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / vals.length;
    variances[i] = varsum;
  }
  let bestIdx = 0;
  let bestV = variances[0];
  for (let i = 1; i < variances.length; i++)
    if (variances[i] > bestV) {
      bestV = variances[i];
      bestIdx = i;
    }
  return bestIdx;
}

function detectSensorCandidates(reports) {
  // heuristics to find battery / gyro / touchpad candidates
  if (!reports || reports.length === 0) return {};
  const len = Math.max(...reports.map((r) => r.length));
  const variances = new Array(len).fill(0);
  const means = new Array(len).fill(0);
  for (let i = 0; i < len; i++) {
    const vals = reports.map((r) => (i < r.length ? r[i] : 0));
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const varsum = vals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / vals.length;
    variances[i] = varsum;
    means[i] = mean;
  }
  // battery candidates: low variance but non-zero mean
  const batteryCandidates = [];
  for (let i = 0; i < len; i++) if (variances[i] < 4 && means[i] > 0) batteryCandidates.push(i);
  // gyro/touchpad: high variance
  const motionCandidates = [];
  for (let i = 0; i < len; i++) if (variances[i] > 20) motionCandidates.push(i);
  return { batteryCandidates, motionCandidates };
}

function inferMappingsFromLabeledReports(labeledPairs) {
  // labeledPairs: array of { label: 'cross', before: [..], after: [..] }
  const perLabel = {};
  for (const p of labeledPairs) {
    const diffs = printDiff(p.before, p.after);
    if (!perLabel[p.label]) perLabel[p.label] = [];
    perLabel[p.label].push(diffs);
  }
  return inferButtonMappings(perLabel);
}

function validateMapping(mapping, labeledPairs) {
  // mapping: { axes:..., buttons: { name: [byteIdx, mask] }, dpad:... }
  // labeledPairs: array of { label, before, after }
  const details = [];
  let ok = true;
  const buttons = mapping && mapping.buttons ? mapping.buttons : {};
  for (const p of labeledPairs) {
    const btn = p.label;
    const m = buttons[btn];
    if (!m) {
      ok = false;
      details.push({ label: btn, ok: false, reason: 'no mapping found' });
      continue;
    }
    const [idx, mask] = m;
    const before = (p.before && p.before[idx]) || 0;
    const after = (p.after && p.after[idx]) || 0;
    const xor = before ^ after;
    const matched = (xor & mask) !== 0;
    // detect collisions with other mappings
    const collisions = [];
    for (const [otherBtn, otherM] of Object.entries(buttons)) {
      if (otherBtn === btn) continue;
      const [oIdx, oMask] = otherM;
      const obefore = (p.before && p.before[oIdx]) || 0;
      const oafter = (p.after && p.after[oIdx]) || 0;
      const oxor = obefore ^ oafter;
      if ((oxor & oMask) !== 0) collisions.push(otherBtn);
    }
    if (!matched) {
      ok = false;
      details.push({
        label: btn,
        ok: false,
        reason: 'mask did not match sample xor',
        idx,
        mask,
        xor,
        collisions,
      });
    } else {
      details.push({ label: btn, ok: true, idx, mask, xor, collisions });
    }
  }
  return { ok, details };
}

module.exports = {
  printDiff,
  chooseCandidateFromDiffs,
  inferButtonMappings,
  inferDpadByte,
  findSingleBitChange,
  findMostVariableByte,
  detectSensorCandidates,
  inferMappingsFromLabeledReports,
  validateMapping,
};
