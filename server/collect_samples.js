#!/usr/bin/env node
// CLI helper to collect labeled before/after report pairs and infer mapping automatically
// Usage: node server/collect_samples.js --label cross --count 3

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const HID = (() => {
  try {
    return require('node-hid');
  } catch (e) {
    return null;
  }
})();
const core = require('./auto_map_core');
const collectLib = require('./collect_lib');

function prompt(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(q, (a) => {
      rl.close();
      resolve(a);
    })
  );
}

async function collect(label, count = 3, timeout = 8000) {
  console.log(
    `Collecting ${count} sample pairs for '${label}'. Please be ready to press/release the control when prompted.`
  );
  const devices = HID ? HID.devices() : [];
  const target = devices.find(
    (d) => /Sony/i.test(d.manufacturer || '') || /Wireless Controller/i.test(d.product || '')
  );
  if (!target)
    console.warn(
      'Warning: no HID device found — you can still run this on a device by connecting it.'
    );

  let device = null;
  if (target) {
    try {
      device = new HID.HID(target.path);
      device.setNonBlocking && device.setNonBlocking(true);
    } catch (e) {
      console.warn('Failed to open HID device:', e);
      device = null;
    }
  }

  const readOnce = (timeoutMs = 8000) => {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const tryRead = () => {
        if (device) {
          try {
            const buf = device.readTimeout ? device.readTimeout(64, 50) : device.read(64);
            if (buf && buf.length) return resolve(Array.from(buf));
          } catch (e) {}
        }
        if (Date.now() - start > timeoutMs) return reject(new Error('timeout'));
        setTimeout(tryRead, 50);
      };
      tryRead();
    });
  };

  // If SIMULATE=1 we run deterministic simulated collection via collectLib
  if (process.env.SIMULATE === '1') {
    console.log('Running deterministic simulated collection (SIMULATE=1)');
    await collectLib.collectSamples({ label, count, timeout, simulate: true }, (s) => {
      console.log('progress', s);
    });
    console.log('Mapping result saved (simulated)');
    return;
  }

  // fallback to manual device-driven collection (existing behavior)
  const pairs = [];
  for (let i = 0; i < count; i++) {
    await prompt(
      `Press the control for sample ${i + 1} (then hit ENTER to capture 'after' report)`
    );
    try {
      const after = await readOnce(timeout);
      // take an immediate before by reading a preceding report if available, otherwise use zeros
      const before = Array.from({ length: after.length }, () => 0);
      pairs.push({ label, before, after });
      console.log('Captured sample', i + 1);
    } catch (e) {
      console.warn('Capture failed:', e.message);
    }
  }

  // save samples
  const samplesPath = path.join(process.cwd(), '.ds4map.samples.json');
  let existing = [];
  try {
    if (fs.existsSync(samplesPath)) existing = JSON.parse(fs.readFileSync(samplesPath, 'utf8'));
  } catch (e) {}
  existing.push(...pairs);
  fs.writeFileSync(samplesPath, JSON.stringify(existing, null, 2));
  console.log('Saved samples to', samplesPath);

  // attempt inference using core
  const mapping = core.inferMappingsFromLabeledReports(
    existing.map((p) => ({ label: p.label, before: p.before, after: p.after }))
  );
  console.log('Inferred mapping (consensus):', mapping);

  // write mapping backup
  const outPath = path.join(process.cwd(), '.ds4map.json');
  try {
    if (fs.existsSync(outPath)) fs.copyFileSync(outPath, outPath + '.bak.' + Date.now());
  } catch (e) {}
  fs.writeFileSync(
    outPath,
    JSON.stringify({ axes: {}, buttons: mapping, dpad: { byte: null, mask: 15 } }, null, 2)
  );
  console.log('Saved mapping to', outPath);
}

async function main() {
  const args = process.argv.slice(2);
  const labelIdx = args.indexOf('--label');
  const countIdx = args.indexOf('--count');
  const label = labelIdx !== -1 ? args[labelIdx + 1] : null;
  const count = countIdx !== -1 ? Number(args[countIdx + 1]) : 3;
  if (!label) {
    console.error('Usage: node server/collect_samples.js --label <name> [--count N]');
    process.exit(2);
  }
  await collect(label, count);
}

if (require.main === module)
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
