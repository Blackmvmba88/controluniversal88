#!/usr/bin/env node
// Interactive mapper for DualShock 4 (Node)
// Usage: MAP=1 node server/mapper.js

const HID = (() => {
  try {
    return require('node-hid');
  } catch (e) {
    return null;
  }
})();
const fs = require('fs');
const path = require('path');

const devices = HID ? HID.devices() : [];
console.log('HID devices:', devices.length);

const target = devices.find(
  (d) => /Sony/i.test(d.manufacturer || '') || /Wireless Controller/i.test(d.product || '')
);
if (!target) {
  console.log(
    'No DualShock-like device found. You can still run mapper in simulated mode with SIMULATE=1.'
  );
}

let device = null;
if (target) {
  try {
    device = new HID.HID(target.path);
    console.log('Opened device:', target.product || target.path);
  } catch (e) {
    console.error('Failed to open HID device:', e);
    device = null;
  }
}

const STATE = { raw: null };

function showHelp() {
  console.log('\nControls:');
  console.log('  Press a button on the controller — mapper prints byte diffs.');
  console.log('  Press Ctrl+C to stop.');
  console.log(
    '  To generate a mapping, press each button once while watching reported diffs and record the (byte,mask) pairs in a file called .ds4map.json'
  );
}

showHelp();

function printDiff(prev, cur) {
  const diffs = [];
  const len = Math.max(prev.length, cur.length);
  for (let i = 0; i < len; i++) {
    const a = prev[i] || 0;
    const b = cur[i] || 0;
    if (a !== b) diffs.push({ idx: i, before: a, after: b });
  }
  if (diffs.length) console.log('Report diffs:', JSON.stringify(diffs));
}

if (device) {
  device.on('data', (buf) => {
    const cur = Buffer.from(buf);
    if (STATE.raw) printDiff(STATE.raw, cur);
    STATE.raw = Array.from(cur);
  });
  device.on('error', (err) => console.error('Device error:', err));
} else {
  // simulation mode
  const simulate = () => {
    const fake = new Uint8Array(16);
    setInterval(() => {
      const idx = Math.floor(Math.random() * 15);
      const mask = 1 << Math.floor(Math.random() * 7);
      fake[idx] ^= mask;
      if (STATE.raw) printDiff(STATE.raw, fake);
      STATE.raw = Array.from(fake);
    }, 700);
  };
  simulate();
}

process.on('SIGINT', () => {
  console.log('\nMapper stopped.');
  process.exit(0);
});
