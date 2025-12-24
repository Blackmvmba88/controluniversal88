[![CI](https://github.com/Blackmvmba88/controluniversal88/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Blackmvmba88/controluniversal88/actions) [![E2E](https://github.com/Blackmvmba88/controluniversal88/actions/workflows/e2e.yml/badge.svg?branch=main)](https://github.com/Blackmvmba88/controluniversal88/actions)
[![Release](https://img.shields.io/github/v/release/Blackmvmba88/controluniversal88)](https://github.com/Blackmvmba88/controluniversal88/releases/latest)
[![License: MIT](https://img.shields.io/github/license/Blackmvmba88/controluniversal88)](LICENSE)
[![PyPI](https://img.shields.io/pypi/v/controluniversal?color=blue)](#)

# ControlUniversal — DualShock 4 Web Monitor (Prototype)

This repo contains prototypes to monitor a DualShock 4 controller and visualize button presses in a WebUI.

## E2E tests (Playwright)

- **What they check:** The E2E suite verifies that the WebUI highlights controller buttons when events arrive and that the axis display updates (basic interaction smoke tests).
- **How to run locally:**

```bash
# install deps and browsers
npm install
npx playwright install --with-deps
# run E2E (Playwright will auto-start the server in SIMULATE mode)
npm run test:e2e
```

- **Troubleshooting:** If Playwright asks to install browsers, run `npx playwright install --with-deps` (CI does this automatically). If a test times out, ensure no firewall blocks localhost:8080 and that `SIMULATE=1` is honored by your shell.
- **CI:** The workflow `.github/workflows/e2e.yml` runs the E2E on pushes to `main` and pull requests; the README badge shows the current E2E status.



Two backends are provided:
- Node.js (recommended for quick prototyping / node-hid support)
- Python (FastAPI) — alternative implementation

Two WebUI variants:
- Lightweight HTML + SVG + small client (`/web/index.html`)
- React (CDN) variant (`/web/index_react.html`)

Quick start (Node, simulation mode):

```bash
# install deps
npm install
# launch server in simulation mode (background) and open browser:
npm run start:dev
# or start simulation-only and open manually:
npm run start:sim &
npm run open
# to run a quick smoke test for WebSocket:
npm run smoke
# to run extended websocket check:
npm run smoke:extended
# to build a minified client script:
npm run build:client
```
Tip: see the **E2E tests** section below for Playwright-based end-to-end tests. Run them locally with `npm run test:e2e`.
Quick start (Python, simulation mode):

```bash
# create virtualenv
python3 -m venv .venv
. .venv/bin/activate
pip install -r python/requirements.txt
# run (simulation):
SIMULATE=1 python3 python/server.py
# open http://localhost:8080/
```

Notes:
- Device access: to use an actual DualShock 4 you may need OS-specific permissions (macOS may require additional steps). Set `SIMULATE=0` to attempt to use HID.
- Mapping and parsing: Node and Python daemons include a best-effort DS4 parser and an interactive mapping mode.
  - Use `MAP=1` to enable mapping mode; it will print byte diffs on input so you can determine which bytes/bits correspond to physical buttons.
  - Add a `.ds4map.json` file in the repo root to override or refine the mapping (an example is provided at `.ds4map.example.json`).
- WebSocket server is on the same origin as the static files (http://localhost:8080). The React UI connects to the same origin.

If you want, I can:
- refine the DS4 parsing further to cover Bluetooth report variants and more fields (touchpad, gyroscope, battery) — done in a heuristic form; the daemons emit sensor candidate suggestions and the calibration UI can surface them.
- add a small interactive mapper script and a CLI helper to collect labeled samples (`server/collect_samples.js`) that generates `.ds4map.json` using consensus-based inference.
- add tests that validate real device input — we added deterministic tests and CI runs Node and Python unit tests. I can further add end-to-end HID stream mocks.

Current useful commands:
- `npm run auto-map` — interactive auto-mapper (consensus-based)
- `node server/collect_samples.js --label cross --count 3` — collect labeled samples for a button and automatically update `.ds4map.json` (backups saved as `.ds4map.json.bak.*`).
- Use the calibration overlay at `http://localhost:8080/` (top-right) to see detected sensor candidates and refresh.

Tell me which piece to implement next or if you want any UI polish or extra tests.

UI accessibility & keyboard shortcuts:
- Enter: Accept in modal (or confirm in message modal)
- Escape: Close modal or cancel current dialog

The guided modal uses ARIA attributes (`role="dialog"`, `aria-labelledby`, `aria-describedby`) and manages focus while open to support keyboard navigation.
