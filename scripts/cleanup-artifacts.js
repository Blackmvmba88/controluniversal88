#!/usr/bin/env node
// Cleanup GitHub artifacts older than X hours using GITHUB_TOKEN env var
const { Octokit } = require('@octokit/rest');
const argv = require('minimist')(process.argv.slice(2));
const hours = Number(argv.hours || argv.h || 24);
const ownerRepo = argv.repo || process.env.GITHUB_REPO;
const token = process.env.GITHUB_TOKEN;
if (!ownerRepo || !token) {
  console.error('Usage: cleanup-artifacts --repo owner/repo (requires GITHUB_TOKEN in env)');
  process.exit(2);
}
const [owner, repo] = ownerRepo.split('/');
const oct = new Octokit({ auth: token });
(async () => {
  const cutoff = Date.now() - hours * 3600 * 1000;
  const resp = await oct.actions.listArtifactsForRepo({ owner, repo, per_page: 100 });
  let removed = 0;
  for (const a of resp.data.artifacts) {
    const created = new Date(a.created_at).getTime();
    if (created < cutoff) {
      await oct.actions.deleteArtifact({ owner, repo, artifact_id: a.id });
      removed++;
      console.log('deleted', a.name);
    }
  }
  console.log('removed artifacts', removed);
})();
