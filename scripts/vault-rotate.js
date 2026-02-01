#!/usr/bin/env node
// Skeleton helper for integrating with HashiCorp Vault to rotate NGROK token.
// This is a placeholder that demonstrates how to write the secret to Vault using Vault's CLI or HTTP API.
// Usage example (CLI): node scripts/vault-rotate.js --token <newtoken> --path secret/data/control-universal/ngrok

const argv = require('minimist')(process.argv.slice(2));
const token = argv.token || argv.t;
const path = argv.path || argv.p;
if (!token || !path) {
  console.error('Usage: vault-rotate.js --token <token> --path <vault-path>');
  process.exit(2);
}

// Prefer using Vault CLI (vault kv put ...)
try {
  const cp = require('child_process');
  // WARNING: Ensure VAULT_ADDR and VAULT_TOKEN are available in environment and have permissions
  cp.execSync(`vault kv put ${path} token=${token}`, { stdio: 'inherit' });
  console.log('Wrote token to Vault at', path);
} catch (e) {
  console.error(
    'Failed to write to Vault. Ensure Vault CLI configured and you have permissions. Error:',
    e.message
  );
  process.exit(1);
}
