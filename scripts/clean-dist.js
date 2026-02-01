#!/usr/bin/env node
// Cleans expired bookmarklet files in dist/ by reading corresponding .meta.json files
const fs = require('fs');
const path = require('path');

function cleanDist({ dryRun = false } = {}) {
  const d = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(d)) return { cleaned: 0 };
  const files = fs.readdirSync(d).filter((f) => f.startsWith('bookmarklet_') && f.endsWith('.txt'));
  let cleaned = 0;
  for (const f of files) {
    try {
      const sha = f.slice('bookmarklet_'.length, -'.txt'.length);
      const metaPath = path.join(d, `bookmarklet_${sha}.txt.meta.json`);
      if (!fs.existsSync(metaPath)) {
        if (!dryRun) {
          fs.unlinkSync(path.join(d, f));
          cleaned++;
        }
        continue;
      }
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      if (meta.expires && Date.now() > meta.expires) {
        if (!dryRun) {
          fs.unlinkSync(path.join(d, f));
          try {
            fs.unlinkSync(metaPath);
          } catch (e) {}
          cleaned++;
        }
      }
    } catch (e) {
      console.warn('failed cleaning', f, e);
    }
  }
  return { cleaned };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const res = cleanDist({ dryRun: dry });
  console.log('clean-dist result', res);
  process.exit(0);
}

module.exports = { cleanDist };
