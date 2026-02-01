Thank you for contributing to ControlUniversal! 🎉

This document explains the standard workflow for contributing code, tests and documentation, and how to run the project's tests locally.

Quick start
- Fork the repo and create a topic branch off `main` with a short, descriptive name (e.g., `fix/validate-mapping`, `feat/playwright-e2e`).
- Open a PR from your branch to `main` and fill the PR template (checked items speed up review).

Development setup
1. Install Node dependencies:
   - npm install
2. (Optional) Install Playwright browsers for E2E tests:
   - npx playwright install --with-deps

Husky & pre-commit hooks
- To enable Husky pre-commit hooks run once after cloning:
  - `npm run prepare`
- The hooks will run `lint-staged` which validates only staged `.json` files for correctness. This reduces the cost of pre-commit checks while preventing accidental JSON syntax regressions.
- If you don't want hooks locally, skip `npm run prepare` (hooks are opt-in).

Running tests
- Unit tests (Node.js):
  - npm test
- Smoke tests (WebSocket):
  - npm run smoke
- Extended smoke test (button/axis):
  - npm run smoke:extended
- E2E (Playwright):
  - npm run test:e2e
  - Playwright will auto-start the server in SIMULATE mode when run via the project config

Making a good PR
- Use a clear title and brief description. Explain: what changed, why, and how to test it.
- Include tests for bug fixes and non-trivial new features.
- Update `README.md` or `CHANGELOG.md` when adding new user-facing features or commands.
- If a change affects the mapping heuristics or DS4 behavior, include sample `.ds4map.samples.json` pairs or deterministic test vectors.

Commit messages
- Use concise imperative messages, e.g., "Fix: validate mapping before save" or "Feat: add Playwright E2E tests".

CI & Checks
- The repository uses GitHub Actions to run unit tests, Playwright E2E and a release workflow. Ensure all tests pass locally before requesting review.

Support & Questions
- If unsure how to proceed with a change, open an issue and describe the problem first. Maintainers will help with design and acceptance criteria.

Thanks again — contributions are welcome and appreciated! ❤️
