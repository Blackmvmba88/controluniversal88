#!/usr/bin/env node
// USB-level diagnostic for vendor-specific controllers (PowerA XBX Spectra)
// Usage: sudo node server/diagnose_usb.js

const usb = require('usb');
const util = require('util');

const VENDOR = 0x20d6; // PowerA
const PRODUCT = 0x4002; // XBX Spectra
const RUN_MS = 15000;

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
    bDeviceSubClass: dd.bDeviceSubClass,
    bDeviceProtocol: dd.bDeviceProtocol,
    busNumber: dev.busNumber,
    deviceAddress: dev.deviceAddress,
    path: dev.portNumbers ? dev.portNumbers.join('.') : '(unknown)',
  };
}

function tryOpen(device) {
  try {
    device.open();
  } catch (err) {
    console.error('open() failed:', err && err.message);
    return false;
  }
  return true;
}

async function run() {
  console.log('Listing USB devices (summary):');
  const list = usb.getDeviceList();
  list.forEach((d, i) => {
    const info = inspectDevice(d);
    console.log(
      `${i}: vendor=0x${(info.vendorId || 0).toString(16)} product=0x${(
        info.productId || 0
      ).toString(16)} class=${info.bDeviceClass} addr=${info.deviceAddress} path=${info.path}`
    );
  });

  // Prefer exact match
  const match = list.find((d) => {
    const dd = d.deviceDescriptor || {};
    return dd.idVendor === VENDOR && dd.idProduct === PRODUCT;
  });

  const candidates = match
    ? [match]
    : list.filter((d) => {
        const dd = d.deviceDescriptor || {};
        // vendor match or product/class hints
        return dd.idVendor === VENDOR || dd.bDeviceClass === 0xff || dd.idProduct === PRODUCT;
      });

  if (candidates.length === 0) {
    console.warn('No candidate devices found; trying all devices as last resort.');
  }

  const toTry = candidates.length ? candidates : list;

  for (const dev of toTry) {
    const dd = dev.deviceDescriptor || {};
    console.log('\n--- Trying device', inspectDevice(dev));

    if (!tryOpen(dev)) continue;

    // Attempt to read manufacturer/product strings (best-effort)
    try {
      const iManufacturer = dd.iManufacturer || 0;
      const iProduct = dd.iProduct || 0;
      if (iManufacturer) {
        dev.getStringDescriptor(iManufacturer, (err, str) => {
          if (!err) console.log('  Manufacturer:', str);
        });
      }
      if (iProduct) {
        dev.getStringDescriptor(iProduct, (err, str) => {
          if (!err) console.log('  Product:', str);
        });
      }
    } catch (e) {
      // ignore
    }

    try {
      const cfg = dev.configDescriptor;
      if (cfg && cfg.interfaces) {
        console.log('  Config has', cfg.interfaces.length, 'interfaces');
      }
    } catch (e) {
      // ignore
    }

    for (const iface of dev.interfaces || []) {
      console.log(
        '  Interface:',
        iface.interfaceNumber,
        'altSetting',
        iface.altSetting && iface.altSetting.length ? iface.altSetting.length : '?'
      );
      let detached = false;
      try {
        if (iface.isKernelDriverActive && iface.isKernelDriverActive()) {
          try {
            iface.detachKernelDriver();
            detached = true;
            console.log('    Detached kernel driver');
          } catch (e) {
            console.log('    detachKernelDriver error', e && e.message);
          }
        }
      } catch (e) {
        // ignore
      }

      try {
        iface.claim();
      } catch (e) {
        console.log('    claim() failed:', e && e.message);
        if (detached) {
          try {
            iface.attachKernelDriver();
          } catch (err) {}
        }
        continue;
      }

      for (const ep of iface.endpoints) {
        console.log(
          `    Endpoint: addr=0x${ep.address.toString(16)} dir=${ep.direction} type=${
            ep.transferType
          } maxPkt=${ep.descriptor.wMaxPacketSize}`
        );

        if (ep.direction === 'in') {
          if (
            ep.transferType === usb.LIBUSB_TRANSFER_TYPE_INTERRUPT ||
            ep.transferType === usb.LIBUSB_TRANSFER_TYPE_BULK
          ) {
            console.log('      Starting poll on endpoint for', RUN_MS, 'ms - press buttons now');
            try {
              ep.startPoll(1, ep.descriptor.wMaxPacketSize);
              ep.on('data', (data) => {
                console.log('      DATA len=' + data.length + ' hex=' + hex(data));
              });
              ep.on('error', (err) => console.error('      endpoint error', err && err.message));
            } catch (e) {
              console.log('      startPoll error', e && e.message);
            }
          } else {
            console.log('      Not an interrupt/bulk IN endpoint, skipping active polling');
          }
        }
      }

      // attach a small transfer fallback if no endpoints/poll
      // sleep RUN_MS while listening
    }

    // wait RUN_MS to collect
    await new Promise((r) => setTimeout(r, RUN_MS));

    // cleanup
    for (const iface of dev.interfaces || []) {
      for (const ep of iface.endpoints || []) {
        try {
          ep.stopPoll();
        } catch (e) {}
      }
      try {
        iface.release(true, (err) => {
          if (err) console.log('    release err', err && err.message);
        });
      } catch (e) {}
      try {
        if (iface.detached) iface.attachKernelDriver();
      } catch (e) {}
    }

    try {
      dev.close();
    } catch (e) {}

    console.log('\n--- Done with device');
  }

  console.log(
    '\nFinished scan. If you saw hex report lines for a device, save them and send them to me; I will infer mappings.'
  );
}

run().catch((err) => {
  console.error('Fatal error:', err && err.stack);
  process.exit(1);
});
