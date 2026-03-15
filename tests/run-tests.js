// Minimal test runner — loads all test modules in this folder ending with .test.js and runs exported functions
const fs = require('fs');
const path = require('path');
const testDir = __dirname;

const files = fs.readdirSync(testDir).filter((f) => f.endsWith('.test.js'));
let failed = 0;

(async function runAll() {
  // Cleanup before tests
  const cleanup = () => {
    try {
      const daemon = require('../server/daemon');
      if (typeof daemon.reset === 'function') daemon.reset();

      if (fs.existsSync('.ds4map.json')) fs.unlinkSync('.ds4map.json');
      const files = fs.readdirSync(process.cwd());
      for (const f of files) {
        if (f.startsWith('.ds4map.json.bak.') || f.startsWith('.ds4map.failed.')) {
          fs.unlinkSync(f);
        }
      }
    } catch (e) {}
  };
  cleanup();

  for (const file of files) {
    cleanup();
    console.log('Running tests in', file);
    const mod = require(path.join(testDir, file));
    for (const [name, fn] of Object.entries(mod)) {
      if (typeof fn !== 'function') continue;
      try {
        const r = fn();
        if (r && typeof r.then === 'function') {
          // async test returning Promise
          await r;
          console.log('  ✓', name);
        } else {
          console.log('  ✓', name);
        }
      } catch (e) {
        failed++;
        console.error('  ✗', name, '-', e && e.message);
        console.error(e && e.stack);
      }
    }
  }

  // Run Python tests too if pytest is available
  const { execSync } = require('child_process');
  try {
    // check that 'python3' is available before running tests
    try {
      execSync('command -v python3', { stdio: 'ignore' });
    } catch (e) {
      console.log('Skipping Python tests: python3 not found');
      throw new Error('skip-python');
    }
    console.log('Running Python tests...');
    execSync('python3 -m pytest -q', { stdio: 'inherit' });
  } catch (e) {
    if (e && e.message === 'skip-python') {
      // do not treat missing python as a failed test run
    } else {
      console.warn('Python tests failed or pytest not available in environment.');
      failed++;
    }
  }

  if (failed) {
    console.error(failed, 'test(s) failed');
    process.exit(1);
  } else {
    console.log('All tests passed');
    process.exit(0);
  }
})();
