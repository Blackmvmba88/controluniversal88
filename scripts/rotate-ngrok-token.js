#!/usr/bin/env node
// Rotate NGROK_AUTH_TOKEN in GitHub repo secrets using `gh` CLI (requires gh authenticated)
// Usage: node scripts/rotate-ngrok-token.js --token <newtoken> --repo owner/repo
const argv = require('minimist')(process.argv.slice(2));
const token = argv.token || argv.t || process.env.NGROK_NEW_TOKEN;
const repo = argv.repo || argv.r || process.env.GITHUB_REPO;
const cp = require('child_process');
if (!token || !repo) {
  console.error('Usage: rotate-ngrok-token --token <newtoken> --repo <owner/repo>');
  process.exit(2);
}
try {
  // Prefer gh CLI for safety and audit trail
  cp.execSync(
    `gh secret set NGROK_AUTH_TOKEN --body "${token.replace(/\"/g, '\\"')}" --repo ${repo}`,
    { stdio: 'inherit' }
  );
  console.log('Updated NGROK_AUTH_TOKEN via gh CLI');
} catch (e) {
  console.error(
    'Failed to update secret via gh CLI. Ensure gh is installed and authenticated. Error:',
    e.message
  );
  process.exit(1);
}
