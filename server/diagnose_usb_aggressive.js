#!/usr/bin/env node
// Aggressive USB-level diagnostic for vendor-specific controllers
// Usage: sudo node server/diagnose_usb_aggressive.js

const usb = require('usb');
const RUN_MS = 30000;
const VENDOR = 0x20d6;
const PRODUCT = 0x4002;

function hex(buf) {
  return Buffer.from(buf)
    .toString('hex')
    .match(/.{1,2}/g)
    .join(' ');
}

function inspectDevice(dev) {
  const dd = dev.deviceDescriptor || {};
  return {
    vendorId: dd.idVendor,
    productId: dd.idProduct,
    bDeviceClass: dd.bDeviceClass,
    busNumber: dev.busNumber,
    deviceAddress: dev.deviceAddress,
    path: dev.portNumbers ? dev.portNumbers.join('.') : '(unknown)',
  };
}

async function tryInterface(dev, iface) {
  console.log('  -> interface', iface.interfaceNumber);
  try {
    if (iface.isKernelDriverActive && iface.isKernelDriverActive()) {
      try {
        iface.detachKernelDriver();
        console.log('    Detached kernel driver');
      } catch (e) {
        console.log('    detach fail', e && e.message);
      }
    }
  } catch (e) {}

  try {
    iface.claim();
  } catch (e) {
    console.log('    claim fail', e && e.message);
    return;
  }

  const altSettings = iface.descriptor && iface.descriptor.bNumEndpoints ? [0] : [0];
  // try to change alt settings if supported
  for (let alt = 0; alt < 4; alt++) {
    try {
      await new Promise((res, rej) => iface.setAltSetting(alt, (err) => (err ? rej(err) : res())));
      console.log('    setAltSetting', alt);
    } catch (e) {
      break; // stop trying alt settings
    }

    for (const ep of iface.endpoints || []) {
      console.log(
        `    Endpoint: addr=0x${ep.address.toString(16)} dir=${ep.direction} type=${
          ep.transferType
        } maxPkt=${ep.descriptor.wMaxPacketSize}`
      );

      if (ep.direction !== 'in') continue;

      if (
        ep.transferType === usb.LIBUSB_TRANSFER_TYPE_INTERRUPT ||
        ep.transferType === usb.LIBUSB_TRANSFER_TYPE_BULK
      ) {
        console.log('      Starting active polling / transfer loop, press buttons now');
        try {
          ep.startPoll(1, ep.descriptor.wMaxPacketSize);
          ep.on('data', (data) => {
            console.log(`      DATA len=${data.length} hex=${hex(data)}
`);
          });
          ep.on('error', (err) => console.error('      endpoint error', err && err.message));
        } catch (e) {
          console.log('      startPoll error', e && e.message);
        }

        // also attempt manual transfers repeatedly
        let stop = false;
        const tryTransfer = () => {
          if (stop) return;
          try {
            ep.transfer(ep.descriptor.wMaxPacketSize, (err, data) => {
              if (err) {
                // ignore occasional errors
              } else if (data && data.length) {
                console.log(`      TRANSFER len=${data.length} hex=${hex(data)}\n`);
              }
              setTimeout(tryTransfer, 200);
            });
          } catch (e) {
            setTimeout(tryTransfer, 500);
          }
        };
        tryTransfer();

        // stop after RUN_MS
        setTimeout(() => {
          stop = true;
          try {
            ep.stopPoll();
          } catch (e) {}
        }, RUN_MS - 500);
      } else {
        console.log('      non-interrupt/bulk IN endpoint');
      }
    }
  }

  // release interface after short wait
  await new Promise((r) => setTimeout(r, 500));
  try {
    iface.release(true, (err) => {
      if (err) console.log('    release err', err && err.message);
    });
  } catch (e) {}
}

async function run() {
  console.log('Starting aggressive USB scan for', RUN_MS, 'ms. Press/Hold buttons now.');
  const list = usb.getDeviceList();
  const candidates = list.filter((d) => {
    const dd = d.deviceDescriptor || {};
    return (
      (dd.idVendor === VENDOR && dd.idProduct === PRODUCT) ||
      dd.bDeviceClass === 0xff ||
      dd.idVendor === VENDOR
    );
  });

  const toTry = candidates.length ? candidates : list;

  for (const dev of toTry) {
    console.log('\n=== Device', inspectDevice(dev));
    try {
      dev.open();
    } catch (e) {
      console.log('  open failed', e && e.message);
      continue;
    }

    try {
      for (const iface of dev.interfaces || []) {
        try {
          await tryInterface(dev, iface);
        } catch (e) {
          console.log('    interface try failed', e && e.message);
        }
      }
    } catch (e) {}

    // give the device RUN_MS time to produce packets
    await new Promise((r) => setTimeout(r, RUN_MS));

    try {
      dev.close();
    } catch (e) {}
    console.log('=== Done device');
  }

  console.log(
    'Aggressive scan finished. If you pressed buttons and you saw DATA/TRANSFER lines with hex, please save them and share.'
  );
}

run().catch((err) => {
  console.error('Fatal', err && err.stack);
  process.exit(1);
});
