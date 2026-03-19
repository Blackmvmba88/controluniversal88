#!/usr/bin/env node
// Usage: node scripts/make-bookmarklet.js --url wss://abcd-1234.ngrok.io
const argv = require('minimist')(process.argv.slice(2));
const { buildBookmarklet, parseRemoteUrl } = require('../server/bookmarklet');
const url = argv.url || argv.u;
if (!url) {
  console.error('Usage: make-bookmarklet --url <wss url>');
  process.exit(2);
}
const parsed = parseRemoteUrl(url);
const snippet = buildBookmarklet(parsed.toString());
console.log(snippet);
// write to dist/
const fs = require('fs');
try {
  fs.mkdirSync('dist');
} catch (e) {}
const safeHost = parsed.host.replace(/[^a-zA-Z0-9.-]/g, '_');
fs.writeFileSync(`dist/bookmarklet_${safeHost}.txt`, snippet);
console.log('Saved to', `dist/bookmarklet_${safeHost}.txt`);
