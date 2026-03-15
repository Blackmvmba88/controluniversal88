#!/usr/bin/env node
// Usage: node scripts/make-bookmarklet.js --url wss://abcd-1234.ngrok.io
const argv = require('minimist')(process.argv.slice(2));
const url = argv.url || argv.u;
if (!url) {
  console.error('Usage: make-bookmarklet --url <wss url>');
  process.exit(2);
}
const host = url.replace(/^wss?:\/\//, '').replace(/\/$/, '');
const bookmarklet = `javascript:(function(){var s=document.createElement('script');s.src='https://${host}/bookmarklet.js';document.head.appendChild(s);setTimeout(function(){connectToController('${url}')},200);})();`;
console.log(bookmarklet);
// write to dist/
const fs = require('fs');
try {
  fs.mkdirSync('dist');
} catch (e) {}
fs.writeFileSync(`dist/bookmarklet_${host.replace(/[:\/]/g, '_')}.txt`, bookmarklet);
console.log('Saved to', `dist/bookmarklet_${host.replace(/[:\/]/g, '_')}.txt`);
