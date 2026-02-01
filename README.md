[![CI](https://github.com/Blackmvmba88/controluniversal88/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Blackmvmba88/controluniversal88/actions) [![E2E](https://github.com/Blackmvmba88/controluniversal88/actions/workflows/e2e.yml/badge.svg?branch=main)](https://github.com/Blackmvmba88/controluniversal88/actions)
[![Release](https://img.shields.io/github/v/release/Blackmvmba88/controluniversal88)](https://github.com/Blackmvmba88/controluniversal88/releases/latest)
[![License: MIT](https://img.shields.io/github/license/Blackmvmba88/controluniversal88)](LICENSE)
[![Code of Conduct](https://img.shields.io/badge/code%20of%20conduct-yes-brightgreen)](CODE_OF_CONDUCT.md)
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

- Device access: to use an actual controller you may need OS-specific permissions (macOS may require additional steps). Set `SIMULATE=0` to attempt to use HID.

> **Note:** Some controllers are _not_ PlayStation/DualShock devices (for example, PowerA XBX Spectra or other XBX/Xbox controllers). This project will now attempt to detect common third‑party controllers (PowerA, XBX, Xbox, generic "Controller"). If your controller is detected but buttons are not mapped correctly, run the interactive mapping (`MAP=1`) and use the calibration UI or `server/collect_samples.js` to collect labeled samples and generate a mapping.

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
- Arrow keys: When enabled in the Calibration panel ("Enable keyboard control"), the arrow keys map to simple axes (throttle/yaw). This is useful when playing via browser/Xbox Cloud — see `tests/playwright/keyboard_control.spec.js` for automated checks.

The guided modal uses ARIA attributes (`role="dialog"`, `aria-labelledby`, `aria-describedby`) and manages focus while open to support keyboard navigation.

---

## Remote testing with ngrok & bookmarklet (quick internet proof-of-concept) ⚡️

If you want to expose your local server to the internet quickly for testing (e.g., to inject events into an online Flight Simulator tab), the fastest approach is to use ngrok and a small bookmarklet that connects the browser tab to our WebSocket server.

1. Install ngrok (or use the ngrok binary):

```bash
# if you have npm installed you can do:
npm i -g ngrok
# or use a downloaded binary: https://ngrok.com/download
```

2. Start your local server in simulate mode (if not already running):

```bash
SIMULATE=1 npm run start
```

3. Run ngrok to forward port 8080:

```bash
ngrok http 8080
```

Ngrok will print a public URL like `https://abcd-1234.ngrok.io`. The websocket endpoint will be `wss://abcd-1234.ngrok.io`.

4. Bookmarklet / injection snippet

- Add the bookmarklet script to the page and connect it to the public WS URL:

Open the page you want to control (e.g., the Flight Simulator tab) and open the DevTools console. Paste:

```js
// add the bookmarklet loader
const s = document.createElement('script');
s.src = 'https://YOUR_HOST/bookmarklet.js'; // replace with your public URL (ngrok)
document.head.appendChild(s);
// wait a moment and connect
setTimeout(() => connectToController('wss://abcd-1234.ngrok.io'), 200);
```

Alternatively, create a bookmark with this URL (replace wss URL and host):

javascript:(function(){var s=document.createElement('script');s.src='https://abcd-1234.ngrok.io/bookmarklet.js';document.head.appendChild(s);setTimeout(function(){connectToController('wss://abcd-1234.ngrok.io')},200); })();

5. Quick verification

- Open `http://localhost:8080/monitor.html` (or the ngrok HTTP URL) and enable keyboard control.
- Press ArrowUp → the server will emit a `button` message with `id: 'f18'` (value 1/0) which the bookmarklet will convert to `keydown/keyup` events inside the Flight Simulator tab.

6. Playwright test

- A Playwright test (`tests/playwright/flightsim_integration.spec.js`) verifies the local end-to-end flow (monitor → server → flightsim_stub → synthetic keyboard events). For remote testing via ngrok you can point the bookmarklet to the public WS and manually test the Flight Simulator.

Notes & safety:

- The bookmarklet only listens for messages and synthesizes DOM KeyboardEvents within the page; it does not capture or send keystrokes from that page back to the server.
- Do not run bookmarklets or scripts from untrusted public URLs.

If you want I can also:

- add a small UI to configure the remote WS URL in the calibration panel (done: see `Remote WS URL` in the Calibration panel in `monitor.html`).
- create a simple GitHub Action that runs the Playwright E2E tests in CI using a public tunnel in ephemeral mode (done: see `.github/workflows/e2e_tunnel.yml`). It prefers `ngrok` if the secret `NGROK_AUTH_TOKEN` is present, otherwise it uses `localtunnel`. The workflow caches `node_modules` and Playwright browsers for speed and uploads the generated bookmarklet as an artifact.
- produce a one-click ngrok + Playwright recipe for an automated remote run (I added `scripts/make-bookmarklet.js` to generate bookmarklet snippets for a supplied URL). To use ngrok in CI, add your auth token as `NGROK_AUTH_TOKEN` in the repository secrets; the workflow will configure ngrok automatically.

### Automation & CI

- New helper: `node scripts/make-bookmarklet.js --url wss://YOUR_PUBLIC` (or `npm run make:bookmarklet -- --url wss://...`) writes `dist/bookmarklet_<host>.txt` and prints the bookmarklet URL.
- CI workflow added: `.github/workflows/e2e_tunnel.yml` uses `localtunnel` to expose the server and runs Playwright E2E against the public URL (set as `BASE_URL` for tests).

Which of those would you like next (more polish, custom domain, or CI retry robustness)?

```javascript
const ds = devices.find((d) =>
  /Sony|PlayStation|Wireless Controller|PowerA|XBX|Xbox|Controller/i.test(
    (d.manufacturer || '') + ' ' + (d.product || '')
  )
);
```
