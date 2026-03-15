#!/usr/bin/env node
const collectLib = require('../server/collect_lib');
const fs = require('fs');
const path = require('path');

async function main() {
  const args = process.argv.slice(2);
  const argv = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--auto') argv.auto = true;
    else if (a === '--save') argv.save = true;
    else if (a === '--label') argv.label = args[++i];
    else if (a === '--count') argv.count = args[++i];
    else if (a === '--help') {
      console.log(
        'Usage: scripts/collect_and_save.js [--auto] [--label NAME] [--count N] [--save]'
      );
      process.exit(0);
    }
  }
  const count = Number(argv.count) || 3;
  const save = !!argv.save;
  const auto = !!argv.auto;
  const label = argv.label || 'manual';

  if (auto) {
    const buttons = [
      'square',
      'cross',
      'circle',
      'triangle',
      'l1',
      'r1',
      'l2_btn',
      'r2_btn',
      'share',
      'options',
      'lstick',
      'rstick',
      'ps',
      'dpad_up',
      'dpad_right',
      'dpad_down',
      'dpad_left',
    ];
    const aggregated = [];
    for (const b of buttons) {
      console.log('Collecting for', b);
      const mapping = await collectLib.collectSamples(
        { label: b, count, simulate: process.env.SIMULATE === '1', save: false },
        (s) => {}
      );
      aggregated.push(mapping);
    }
    const final = { axes: {}, buttons: {}, dpad: { byte: null, mask: 15 } };
    for (const m of aggregated) {
      Object.assign(final.axes, m.axes || {});
      Object.assign(final.buttons, m.buttons || {});
      if (m.dpad && m.dpad.byte) final.dpad = m.dpad;
    }
    // validate using samples file
    let samples = [];
    try {
      samples = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), '.ds4map.samples.json'), 'utf8')
      );
    } catch (e) {}
    const core = require('../server/auto_map_core');
    const validation = core.validateMapping(final, samples);
    console.log('Validation result:', validation.ok ? 'OK' : 'FAILED', validation.details || '');
    if (save && validation.ok) {
      const daemon = require('../server/daemon');
      daemon.saveMapping(final);
      console.log('Saved mapping to .ds4map.json');
    } else if (save) {
      const failedPath = path.join(process.cwd(), `.ds4map.failed.${Date.now()}.json`);
      fs.writeFileSync(failedPath, JSON.stringify({ mapping: final, validation }, null, 2));
      console.log('Validation failed; wrote failed mapping to', failedPath);
    }
    console.log('Final mapping:', final);
    process.exit(0);
  } else {
    console.log('Collecting samples for label', label, 'count', count, 'save', save);
    const mapping = await collectLib.collectSamples(
      { label, count, simulate: process.env.SIMULATE === '1', save },
      (s) => {
        if (s && s.step) console.log('progress:', s.step);
      }
    );
    console.log(
      'Done. Validation:',
      mapping._validation && mapping._validation.ok ? 'OK' : 'FAILED'
    );
    if (mapping._saved) console.log('Mapping saved to .ds4map.json');
    if (mapping._failedPath) console.log('Failed mapping saved to', mapping._failedPath);
    process.exit(mapping._validation && mapping._validation.ok ? 0 : 2);
  }
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
