const fs = require('fs');
const path = require('path');
const { cleanDist } = require('../scripts/clean-dist');

function testCleanDist() {
  const d = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(d)) fs.mkdirSync(d);
  // create an expired bookmarklet and meta
  const filename = 'bookmarklet_testexpired.txt';
  const meta = { url: 'http://x', sha: 'testexpired', expires: Date.now() - 1000 };
  fs.writeFileSync(path.join(d, filename), 'x');
  fs.writeFileSync(path.join(d, filename + '.meta.json'), JSON.stringify(meta));

  const res = cleanDist({ dryRun: false });
  if (res.cleaned < 1) throw new Error('expected cleaned >= 1');
  return Promise.resolve();
}

module.exports = { testCleanDist };
