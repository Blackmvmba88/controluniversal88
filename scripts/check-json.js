#!/usr/bin/env node
const fs = require('fs').promises;
const path = require('path');

const IGNORES = ['node_modules', '.git', 'dist', 'coverage'];
let errors = [];

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const name = e.name;
    if (IGNORES.includes(name)) continue;
    const full = path.join(dir, name);
    if (e.isDirectory()) {
      await walk(full);
    } else if (name.endsWith('.json')) {
      await checkJson(full);
    }
  }
}

async function checkJson(file) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    JSON.parse(raw);
  } catch (err) {
    errors.push({ file, err: err.message });
  }
}

(async function main() {
  try {
    await walk(process.cwd());
  } catch (err) {
    console.error('Failed to scan files:', err);
    process.exit(2);
  }
  if (errors.length) {
    console.error('JSON syntax errors found:');
    for (const e of errors) {
      console.error(` - ${e.file}: ${e.err}`);
    }
    process.exit(1);
  }
  console.log('All JSON files are valid.');
  process.exit(0);
})();
