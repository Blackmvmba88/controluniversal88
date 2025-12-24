# Copilot / AI Agent Instructions — ControlUniversal

**Purpose:** Short, actionable guidance for AI coding agents to become productive quickly in this repository. The project appears to be empty now; these instructions focus on discovery steps and concrete checks an agent should perform when files are present.

## Quick discovery checklist (run immediately)
1. Inspect repo root for common manifests: `package.json`, `pyproject.toml`, `requirements.txt`, `Pipfile`, `setup.py`, `Cargo.toml`, `go.mod`, `Makefile`, `Dockerfile`, `.github/workflows/**`, `README.md`.
2. If `package.json` exists, run: `cat package.json` and look for `scripts` (e.g., `test`, `build`, `start`). Example: if `scripts.test` -> `npm ci && npm test`.
3. If `pyproject.toml` or `requirements.txt` exists, look for test commands (e.g., `pytest`) and dependencies. Example: `python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt && pytest -q`.
4. Search for tests (`**/tests/**`, `**/*_test.py`, `**/spec/**`) and run the test command found in manifests or `pytest` / `npm test` as applicable.
5. Inspect `.github/workflows` for CI steps to mirror local verification steps (lint, build, test, release).

## Architecture & component discovery
- Look for top-level directories that indicate boundaries: `cmd/`, `pkg/`, `services/`, `api/`, `ui/`, `server/`, `client/`, `tests/`, `scripts/`.
- Open entry points: for Node: `src/index.js` / `src/app.js`; for Python: `src/__main__.py` or package `__init__.py`; for Go: `cmd/*`.
- If a `Dockerfile` or `docker-compose.yml` exists, use it to infer runtime dependencies, ports, and healthchecks.
- If multiple services exist (monorepo), note communication patterns (HTTP, gRPC, message queues) by scanning for libraries: `express`, `fastapi`, `grpc`, `kafka`, `rabbitmq`, etc.

## Project-specific conventions to check (examples)
- Build and test commands are authoritative if present in `package.json`/`pyproject`/`Makefile` — prefer them over ad-hoc commands.
- Linting and formatting: search for `eslint`, `prettier`, `black`, `ruff`, and prefer project config (e.g., `.eslintrc`, `pyproject.toml`) when making edits.
- Commit style / branch rules: check `CONTRIBUTING.md`, `README.md`, `.github/*` for release/versioning conventions.

## Integration & external dependencies
- Look for external config: `.env`, `.env.example`, `values.yaml`, `secrets/*.enc` — prefer not to commit secrets; ask the human if secrets or credentials are needed.
- If SDKs or external services are present (AWS, GCP, Azure, Sentry, Datadog), config is likely under `infra/`, `ops/`, or in workflow files — document endpoints and credentials holes and ask for access.

## How to change code safely
- Start with local reproducible build/test loop (use `Makefile` or `scripts` if present). If no tests exist, add minimal unit tests that demonstrate behavior changes; prefer small, focused tests.
- When changing behavior that affects multiple components, run integration steps (e.g., `docker-compose up` or start dev services) if the repo contains those artifacts.
- Keep pull request diffs focused: one logical change per PR, update or add tests + update changelog if present.

## PR and commit guidance
- Use existing test commands and CI steps as checklist before proposing changes.
- Include concise PR description: problem, change, verification steps, and which files to review.

## If repository is empty or missing expected files
1. Ask the maintainer for the intended language, package manager, and how to run tests locally.
2. Propose a minimal `README.md`, `Makefile`, test harness, and a CI workflow stub (`.github/workflows/ci.yml`) to define the project's basic developer loop.

---

## Project: DualShock 4 Web Monitor — ControlUniversal

This repository contains prototypes to monitor DualShock 4 input events and visualize them in a WebUI. When working on this project, focus on these files and patterns:

- `server/daemon.js` / `python/daemon.py` — device input readers. Both include a **SIMULATE** mode (`SIMULATE=1`) for development without hardware.
- `server/server.js` / `python/server.py` — lightweight servers that serve `/web` and re-broadcast input events over WebSocket.
- `web/index.html` + `web/client.js` — lightweight UI using SVG with DOM ids matching the emitted button ids (e.g., `cross`, `circle`, `triangle`, `dpad_up`).
- `web/index_react.html` + `web/client_react.js` — React CDN-based variant for exploring a component approach.
- `package.json` and `python/requirements.txt` — install and runtime commands; prefer using the project's `scripts` (e.g., `npm start`).

Project-specific tips:
- Prefer using `SIMULATE=1` during initial development to avoid HID permission issues on macOS; the daemons emit consistent `button` and `axis` JSON messages that the UI expects.
- The repo includes two mapping helpers:
  - `server/mapper.js` / `python/mapper.py` — print byte diffs for manual inspection (useful when pressing a button and watching which bytes change).
  - `server/auto_map.js` / `python/auto_map.py` — interactive auto-mapper that prompts you to press/move inputs and attempts to generate `.ds4map.json` automatically.
- Use `MAP=1` for a lightweight interactive mapping mode in the daemons (prints diffs while you press buttons).
- Mapping output: `.ds4map.json` contains `axes`, `buttons` and `dpad` entries. Review generated masks; you may need to coerce mask values to hex or decimal depending on preference.
- Tests & CI: unit tests live in `tests/` and a minimal test runner (`tests/run-tests.js`) is used locally and in CI. The GitHub Actions workflow (`.github/workflows/ci.yml`) starts the server in `SIMULATE=1` mode and runs smoke tests + unit tests. When adding tests, prefer deterministic inputs (use `tests/simulate_events.js`) and keep tests hermetic.
- Calibration & heuristics: The auto-mapper now includes a consensus-based inference (`server/auto_map_core.js::inferMappingsFromLabeledReports`) that aggregates multiple press samples and prefers single-bit diffs; use `node server/auto_map.js` to collect samples and generate `.ds4map.json`. There is also a small CLI helper `node server/collect_samples.js --label <name> --count <n>` to collect labeled before/after samples and automatically infer and save mapping (backups are created as `.ds4map.json.bak.<ts>`).
- Automation: The server exposes collection endpoints: `POST /api/collect/start` (`{label,count,save}`) starts a collection job (set `save=false` to preview without persisting), `GET /api/collect/status` reads job progress, and `POST /api/collect/auto` runs a full button sweep automatically (supports `save` flag). The server broadcasts `collect_status` messages over WebSocket so the UI sees live progress; use the calibration overlay to initiate jobs and monitor progress.
- Sensors & calibration UI: the daemons keep a short history of recent reports and expose sensor candidates (battery/motion) via `/api/status`. The lightweight UI includes a calibration overlay (top-right) that shows recent sensor candidates and a refresh button. When validating new heuristics, add deterministic labeled report pairs in tests and prefer small, reproducible data sets.
- Logging & backups: use `LOG_LEVEL` to control runtime logging (see `server/logger.js`) and mappings are backed up before overwrite. Prefer conservative updates and save backups when implementing mapping changes.
- UI mapping: the SVG element `id` attributes are authoritative — update the UI and tests to match those ids when adding new controls.

If anything above is unclear or you'd like this tailored with concrete examples from an existing snapshot of the codebase, please add files or point me to the intended project layout and I'll update this file accordingly. ✅
