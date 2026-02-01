#!/usr/bin/env node
const fs = require('fs').promises;
const path = require('path');

const files = process.argv.slice(2).filter(f => f.endsWith('.json'));
if (!files.length) {
  console.log('No JSON files to check.');
  process.exit(0);
}

let hadError = false;
(async function main() {
  for (const f of files) {
    try {
      const data = await fs.readFile(f, 'utf8');
      JSON.parse(data);
    } catch (err) {
      console.error(`${f}: ${err.message}`);
      hadError = true;
    }
  }
  if (hadError) process.exit(1);
  console.log('Staged JSON files are valid.');
})();
