const HID = require('node-hid');
const devices = HID.devices();

console.log('--- HID Devices List ---');
if (devices.length === 0) {
  console.log(
    'No HID devices found. Make sure you have permissions (sudo might be needed on Linux, or check macOS Security & Privacy).'
  );
} else {
  devices.forEach((d, i) => {
    console.log(`[${i}] ${d.product} (${d.manufacturer})`);
    console.log(`    Vendor ID: ${d.vendorId} (0x${d.vendorId.toString(16)})`);
    console.log(`    Product ID: ${d.productId} (0x${d.productId.toString(16)})`);
    console.log(`    Path: ${d.path}`);
    console.log(`    Interface: ${d.interface}`);
    console.log('------------------------');
  });
}

const controllers = devices.filter((d) =>
  /Sony|PlayStation|Wireless Controller|PowerA|XBX|Xbox|Controller/i.test(
    (d.manufacturer || '') + ' ' + (d.product || '')
  )
);
console.log(`\nDetected ${controllers.length} potential controllers:`);
controllers.forEach((c) => console.log(` - ${c.product}`));
