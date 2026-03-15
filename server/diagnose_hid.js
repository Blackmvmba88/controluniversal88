const HID = (() => {
  try {
    return require('node-hid');
  } catch (e) {
    console.error('node-hid not available', e);
    process.exit(1);
  }
})();

console.log('Listing HID devices:');
const devs = HID.devices();
console.log(devs);

const pattern = /powera|xbx|spectra|xbox|controller/i;
const matches = devs.filter(
  (d) =>
    pattern.test((d.product || '') + ' ' + (d.manufacturer || '')) ||
    d.vendorId === 8406 ||
    d.productId === 16386
);
console.log('\nMatches (by product/manufacturer/vendor/product):', matches);

if (matches.length === 0) {
  console.log('\nNo obvious matches found. Showing all devices with index and path:');
  devs.forEach((d, i) => {
    console.log(i, d.path, d.vendorId, d.productId, d.manufacturer, d.product);
  });
  process.exit(0);
}

// Try open each matched device and listen for data for 12 seconds
let opened = [];
for (const d of matches) {
  try {
    console.log('\nAttempting to open', d.path, d.manufacturer, d.product, d.vendorId, d.productId);
    const h = new HID.HID(d.path);
    opened.push({ d, h });
    h.on('data', (buf) => {
      console.log('DATA from', d.path, 'len', buf.length, Buffer.from(buf).toString('hex'));
    });
    h.on('error', (e) => {
      console.warn('ERROR from', d.path, e && e.message);
    });
  } catch (e) {
    console.warn('OPEN FAILED', d.path, e && e.message);
  }
}

if (opened.length === 0) {
  console.log('No devices opened. You may need to run as sudo or check drivers.');
  process.exit(0);
}

console.log('\nListening for 15s. Press buttons now on the controller.');
setTimeout(() => {
  console.log('Done listening, closing devices');
  opened.forEach((x) => {
    try {
      x.h.close();
    } catch (_) {}
  });
  process.exit(0);
}, 15000);
