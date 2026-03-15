#!/usr/bin/env node
// Probe vendor-specific device with safe control transfers and descriptor dump
// Usage: sudo node server/usb_probe_control.js

const usb = require('usb');
const util = require('util');
const VENDOR = 0x20d6;
const PRODUCT = 0x4002;
const TIMEOUT = 1000;

function hex(buf) {
  if (!buf) return '';
  return Buffer.from(buf)
    .toString('hex')
    .match(/.{1,2}/g)
    .join(' ');
}

function dumpDevice(dev) {
  const dd = dev.deviceDescriptor || {};
  console.log('DeviceDescriptor:', {
    idVendor: '0x' + (dd.idVendor || 0).toString(16),
    idProduct: '0x' + (dd.idProduct || 0).toString(16),
    bDeviceClass: dd.bDeviceClass,
    bNumConfigurations: dd.bNumConfigurations,
  });
  try {
    console.log(
      '  bus',
      dev.busNumber,
      'addr',
      dev.deviceAddress,
      'path',
      dev.portNumbers && dev.portNumbers.join('.')
    );
  } catch (e) {}
  try {
    console.log(
      '  current configuration:',
      dev.deviceDescriptor && dev.deviceDescriptor.bNumConfigurations
    );
    console.log('  configDescriptor:', util.inspect(dev.configDescriptor, { depth: 4 }));
  } catch (e) {}
}

async function doControl(dev, bmRequestType, bRequest, wValue, wIndex, lengthOrData, description) {
  return new Promise((resolve) => {
    console.log(
      `-- control ${description}: bm=0x${bmRequestType.toString(16)} req=0x${bRequest.toString(
        16
      )} wVal=0x${wValue.toString(16)} wIdx=0x${wIndex.toString(16)}`
    );
    const callback = (err, data) => {
      if (err) {
        console.log('   err:', err && err.message);
        return resolve(null);
      }
      console.log('   reply len=', data && data.length, 'hex=', hex(data));
      resolve(data);
    };

    try {
      if (Buffer.isBuffer(lengthOrData)) {
        // host-to-device
        dev.controlTransfer(
          bmRequestType,
          bRequest,
          wValue,
          wIndex,
          lengthOrData,
          TIMEOUT,
          callback
        );
      } else {
        // device-to-host
        dev.controlTransfer(
          bmRequestType,
          bRequest,
          wValue,
          wIndex,
          lengthOrData,
          TIMEOUT,
          callback
        );
      }
    } catch (e) {
      console.log('   exception', e && e.message);
      resolve(null);
    }
  });
}

async function run() {
  const dev = usb
    .getDeviceList()
    .find(
      (d) =>
        d.deviceDescriptor &&
        d.deviceDescriptor.idVendor === VENDOR &&
        d.deviceDescriptor.idProduct === PRODUCT
    );
  if (!dev) {
    console.error('Device not found');
    process.exit(1);
  }

  console.log('Found device, attempting open');
  try {
    dev.open();
  } catch (e) {
    console.error('open failed', e && e.message);
  }

  dumpDevice(dev);

  // Try to get standard strings
  try {
    const s = dev.getStringDescriptor;
    if (s) {
      const ids = [
        dev.deviceDescriptor.iManufacturer,
        dev.deviceDescriptor.iProduct,
        dev.deviceDescriptor.iSerialNumber,
      ];
      for (const id of ids) {
        if (!id) continue;
        try {
          await new Promise((res) =>
            dev.getStringDescriptor(id, (err, str) => {
              if (!err) console.log('  string', id, str);
              res();
            })
          );
        } catch (e) {}
      }
    }
  } catch (e) {}

  // Try safe device-to-host vendor requests
  const probes = [
    { bm: 0xc0, req: 0x00, wVal: 0x0000, wIdx: 0x0000, len: 64, desc: 'vendor read 0' },
    { bm: 0xc0, req: 0x01, wVal: 0x0000, wIdx: 0x0000, len: 64, desc: 'vendor read 1' },
    { bm: 0xc0, req: 0x02, wVal: 0x0000, wIdx: 0x0000, len: 64, desc: 'vendor read 2' },
    { bm: 0xc0, req: 0x03, wVal: 0x0000, wIdx: 0x0000, len: 64, desc: 'vendor read 3' },
    {
      bm: 0x80,
      req: 0x06,
      wVal: 0x0100,
      wIdx: 0x0000,
      len: 64,
      desc: 'get device descriptor (0x0100)',
    },
  ];

  for (const p of probes) {
    await doControl(dev, p.bm, p.req, p.wVal, p.wIdx, p.len, p.desc);
  }

  // Try small host-to-device vendor writes (non-destructive)
  const writes = [
    {
      bm: 0x40,
      req: 0x01,
      wVal: 0x0000,
      wIdx: 0x0000,
      data: Buffer.from([0x01, 0x00]),
      desc: 'vendor write 1',
    },
    {
      bm: 0x40,
      req: 0x02,
      wVal: 0x0000,
      wIdx: 0x0000,
      data: Buffer.from([0x00]),
      desc: 'vendor write 2',
    },
  ];

  for (const w of writes) {
    await doControl(dev, w.bm, w.req, w.wVal, w.wIdx, w.data, w.desc);
  }

  // Try to set configuration to 1 (if not set)
  try {
    if (
      dev.deviceDescriptor &&
      dev.deviceDescriptor.bNumConfigurations &&
      dev.deviceDescriptor.bNumConfigurations > 0
    ) {
      try {
        dev.setConfiguration(1, (err) => {
          if (err) console.log(' set config err', err && err.message);
          else console.log(' set config OK');
        });
      } catch (e) {
        console.log(' set config exception', e && e.message);
      }
    }
  } catch (e) {}

  // Wait a bit for any potential events
  await new Promise((r) => setTimeout(r, 1000));

  try {
    dev.close();
  } catch (e) {}
  console.log(
    'Probe complete. If you have device-specific docs or vendor commands, share them and I can try targeted probes.'
  );
}

run().catch((err) => {
  console.error('Fatal', err && err.stack);
  process.exit(1);
});
