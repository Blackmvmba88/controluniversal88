#!/usr/bin/env node
// Interactive auto-mapper for DualShock 4 (Node)
// Usage: node server/auto_map.js
// Run with SIMULATE=0 and attach controller. If SIMULATE mode is used this script cannot auto-detect presses reliably.

const HID = (() => {
  try {
    return require('node-hid');
  } catch (e) {
    return null;
  }
})();
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const BUTTONS = [
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
const AXES = ['lstick_x', 'lstick_y', 'rstick_x', 'rstick_y', 'l2', 'r2'];

function prompt(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(q, (a) => {
      rl.close();
      resolve(a);
    })
  );
}

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

async function run() {
  const devices = HID ? HID.devices() : [];
  const target = devices.find(
    (d) => /Sony/i.test(d.manufacturer || '') || /Wireless Controller/i.test(d.product || '')
  );
  if (!target)
    console.log(
      'No DualShock-like device found; please connect device or run in SIMULATE=1 and press keys on your controller emulator'
    );

  let device = null;
  if (target) {
    try {
      device = new HID.HID(target.path);
      console.log('Opened HID', target.product || target.path);
    } catch (e) {
      console.error('Failed to open HID device', e);
      device = null;
    }
  }

  let state = { raw: null };
  let listeners = [];
  const readBuf = (buf) => {
    const arr = Array.from(Buffer.from(buf));
    if (state.raw) state.raw = arr;
    else state.raw = arr;
    listeners.forEach((fn) => fn(arr));
  };

  if (device) {
    device.on('data', readBuf);
    device.on('error', (e) => console.error('Device error', e));
  } else {
    // can't reliably auto-map without device; exit
    console.log('Mapper requires a real device. Exiting.');
    process.exit(1);
  }

  const mapping = { axes: {}, buttons: {}, dpad: { byte: null, mask: null } };

  // Helper to wait for a diff and return changed xor masks
  function waitDiff(timeout = 8000) {
    return new Promise((resolve, reject) => {
      const st = state.raw ? state.raw.slice() : null;
      const timer = setTimeout(() => {
        listeners = listeners.filter((f) => f !== onDiff);
        reject(new Error('timeout'));
      }, timeout);
      function onDiff(arr) {
        const diffs = printDiff(st || [], arr);
        if (diffs.length) {
          clearTimeout(timer);
          listeners = listeners.filter((f) => f !== onDiff);
          resolve(diffs);
        }
      }
      listeners.push(onDiff);
    });
  }

  console.log(
    'Auto-mapping will now prompt for each button. For each prompt, press and release the specified button once.'
  );

  // Collect multiple attempts per button and use consensus inference
  const collected = {};
  for (const btn of BUTTONS) {
    await prompt(
      `Ready for button \'${btn}\' — press it now then hit ENTER when you pressed it (or wait to timeout)...`
    );
    try {
      const diffs = await waitDiff(8000);
      if (!collected[btn]) collected[btn] = [];
      collected[btn].push(diffs);
      console.log('Recorded diffs for', btn, '->', JSON.stringify(diffs));
    } catch (e) {
      console.log('Timeout or error mapping', btn, e.message);
    }
  }

  // Use core inference to pick best candidates across attempts
  const core = require('./auto_map_core');
  mapping.buttons = core.inferButtonMappings(collected);
  console.log('Consensus button mapping:', mapping.buttons);

  // Dpad directions: prompt individually
  const dpadDirs = ['dpad_up', 'dpad_right', 'dpad_down', 'dpad_left'];
  console.log('\nMapping dpad directions — press each direction once when prompted.');
  const dpadByteCounts = {};
  for (const d of dpadDirs) {
    await prompt(`Ready for ${d} — press it then ENTER`);
    try {
      const diffs = await waitDiff(8000);
      // find low nibble change
      const cand = diffs[0];
      if (cand) {
        // record nibble byte index
        mapping.dpad.byte = cand.idx;
        mapping.dpad.mask = 0x0f;
        console.log('Dpad byte index likely', cand.idx);
      }
    } catch (e) {
      console.log('Timeout mapping', d);
    }
  }

  // Axes mapping: ask user to move sticks left/right/up/down
  console.log(
    '\nAxes mapping: move provided axes when prompted (e.g., move left stick left/right/up/down).'
  );
  for (const ax of AXES) {
    await prompt(`Ready to move axis ${ax} (move it now then press ENTER)`);
    try {
      const diffs = await waitDiff(8000);
      if (diffs.length) {
        const cand = diffs[0];
        mapping.axes[ax] = cand.idx;
        console.log('Mapped axis', ax, 'to byte', cand.idx);
      }
    } catch (e) {
      console.log('Timeout mapping axis', ax);
    }
  }

  const outPath = path.join(process.cwd(), '.ds4map.json');
  // Backup and save using helper
  try {
    const utils = require('./auto_map_utils');
    utils.saveMappingWithBackup(
      {
        axes: mapping.axes || {},
        buttons: mapping.buttons || {},
        dpad: mapping.dpad || { byte: null, mask: 15 },
      },
      outPath
    );
    console.log('Saved mapping to', outPath);
  } catch (e) {
    console.error('Failed to save mapping:', e);
  }

  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(2);
});
