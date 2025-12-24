# ControlUniversal — Physical Input → Digital Reality

> **For streamers, educators, and creative coders** who want to **visualize and understand controller input** without writing low-level HID parsers or wrestling with byte arrays.

**ControlUniversal** bridges the physical and digital worlds: connect a DualShock 4 controller and instantly see every button press, stick movement, and trigger pull in a clean WebUI. No driver hell. No cryptic documentation. Just plug in, run a command, and watch your inputs come alive.

[![Architecture](docs/architecture.svg)](docs/architecture.svg)

## What Is This? (5-Second Version)

Transform your DualShock 4 into a **visual, web-based input monitor** that:
- **Works immediately** with simulation mode (no hardware required for dev/testing)
- **Speaks WebSockets** so you can pipe controller input anywhere (stream overlays, art installations, MIDI/OSC bridges, data viz)
- **Self-calibrates** with interactive mapping tools (no manual byte hunting)
- **Runs everywhere** via Node.js or Python backends

Perfect for Twitch overlays, teaching game development, interactive art, accessibility tools, or just understanding what your controller is actually doing.

---

## Quick Start (60 Seconds to Working Demo)

**Node.js** (recommended):
```bash
npm install
SIMULATE=1 npm start
# → Open http://localhost:8080 and see simulated controller input
```

**Python** (alternative):
```bash
python3 -m venv .venv && . .venv/bin/activate
pip install -r python/requirements.txt
SIMULATE=1 python3 python/server.py
# → Open http://localhost:8080
```

**With real DualShock 4**: Plug in your controller via USB, drop `SIMULATE=1`, and run the same command. May require OS permissions (see [Troubleshooting](#troubleshooting)).

---

## Real-World Use Cases

This isn't just another toy project. Here's where ControlUniversal shines:

### 🎥 **For Streamers & Content Creators**
Display live controller input on-screen during gameplay tutorials or speedruns. WebSocket output makes it trivial to integrate with OBS, Streamlabs, or custom overlays.

### 🎓 **For Educators & Game Dev Teachers**
Show students how controllers actually work—button debouncing, analog stick dead zones, trigger curves—all visualized in real-time. No more black-box mystery.

### 🎨 **For Creative Coders & Interactive Artists**
Use the DS4 as a general-purpose input device for generative art, live visuals, or interactive installations. WebSocket bridge means you can connect to Processing, TouchDesigner, Max/MSP, or any tool that speaks JSON.

### ♿ **For Accessibility Tool Developers**
Prototype custom input mappings, test adaptive controllers, or build assistive tech that remaps physical controls to different outputs.

### 🔧 **For Hardware Hackers**
Reverse-engineer unknown controllers or prototype new HID devices. The auto-mapper saves you hours of staring at hex dumps.

---

## Project Status (Radical Honesty Mode)

### ✅ **What Works Right Now**
- **Simulation mode**: Runs without hardware, generates realistic input patterns for dev/testing
- **Basic button mapping**: Face buttons (Cross, Circle, Square, Triangle), triggers (L1, R1, L2, R2), shoulder buttons, D-pad, analog sticks
- **WebSocket streaming**: Real-time JSON events (`{type: 'button', id: 'cross', value: 1}`)
- **Two backend implementations**: Node.js (stable, fast) and Python/FastAPI (feature parity)
- **SVG-based WebUI**: Lightweight, responsive, keyboard-accessible
- **Interactive auto-mapper**: Consensus-based button detection with automatic `.ds4map.json` generation
- **CI/CD**: Automated tests run on every commit

### ⚠️ **What's "Good Enough" (Works, but Needs Love)**
- **Advanced sensors (gyroscope, accelerometer, touchpad)**: Detects candidates heuristically, but not production-ready
- **Battery level**: Parsed but not calibrated across all firmware versions
- **Bluetooth support**: USB works great; Bluetooth report format differs and isn't fully tested
- **Cross-platform HID permissions**: macOS sometimes requires manual permission grants; Linux may need udev rules

### ❌ **What Doesn't Work Yet**
- **DualSense (PS5) support**: Different HID protocol, not yet mapped
- **Multiple simultaneous controllers**: Single-device only for now
- **Historical replay**: No input recording/playback feature
- **Customizable WebUI themes**: Hardcoded colors and layout

We ship what we have. You see the warts. That's how trust gets built.

---

## The Future Frontier (Where This Could Go)

ControlUniversal started as a DS4 monitor, but the architecture is **protocol-agnostic**. Here's the vision:

### 🎯 **Near-Term (Actively Exploring)**
- **DualSense (PS5) controller support** → different report IDs, haptic feedback API
- **Xbox controller support** → XInput protocol wrapper
- **Multi-controller mode** → simultaneous 4-player input visualization
- **Input recording & replay** → save sessions, generate test fixtures
- **WebUI themes** → dark mode, colorblind-friendly palettes, custom layouts

### 🚀 **Mid-Term (Technically Feasible)**
- **MIDI/OSC bridge** → map controller input to music production software (Ableton, Bitwig)
- **Bluetooth variant support** → decode BT-specific report formats
- **Generic HID mapper** → point at any USB device, auto-generate parsers
- **Advanced sensor fusion** → combine gyro + accel for 3D orientation tracking

### 🌌 **Long-Term (Moonshots)**
- **ControlUniversal Protocol**: A lingua franca for physical input → digital events
- **Browser extension**: Capture controller input from any web app
- **Adaptive controller ecosystem**: Open-source firmware for DIY accessibility devices
- **Generative art integration**: Built-in bridges to p5.js, Three.js, Hydra

This repo is a **nucleus**, not an island. Contributions that expand the frontier are deeply welcome.

---

## How to Extend This (Developer Guide)

Want to add support for a new controller, sensor, or output format? Here's the mental map:

### 📁 **Directory Structure**
```
server/         → Node.js backend (daemon, server, mapping tools)
python/         → Python/FastAPI backend (parallel implementation)
web/            → WebUI clients (vanilla JS + React variants)
tests/          → Unit tests, integration tests, simulated events
docs/           → Architecture diagrams, guides
.ds4map.json    → Button/axis mapping config (auto-generated or manual)
```

### 🔧 **Adding a New Controller**
1. **Create a parser module**: Copy `server/daemon.js` → `server/daemon_xbox.js`
2. **Define button map**: Add vendor-specific byte layouts in the parser
3. **Test with simulation**: Use `SIMULATE=1` to validate events without hardware
4. **Update WebUI**: Add new SVG elements in `web/index.html` with matching `id` attributes
5. **Run auto-mapper**: `node server/auto_map.js` to calibrate mapping interactively

### 🎨 **Adding a New WebUI**
1. Create `web/index_custom.html` with your design
2. Import `/web/client.js` or write custom WebSocket handler
3. Listen for `{type: 'button'|'axis', id: string, value: number}` events
4. Update element IDs to match emitted button names
5. Test with `SIMULATE=1` for consistent input patterns

### 🌐 **Adding a New Output Bridge**
1. Subscribe to daemon events in `server/server.js` or `python/server.py`
2. Transform JSON events to target protocol (MIDI, OSC, HTTP POST, etc.)
3. See `server/daemon.js` → `EventEmitter` pattern for hooking into input stream

### 📊 **Adding Sensors (Gyro, Battery, etc.)**
1. Add byte-range heuristics in `daemon.js::_detectSensorCandidates()`
2. Emit normalized events: `{type: 'sensor', id: 'battery', value: 0-100}`
3. Update calibration UI in `web/index.html` to surface new sensor types
4. Test consensus-based detection with `server/collect_samples.js`

**Pro Tip**: Use `MAP=1` mode to see raw byte diffs while pressing buttons. This is faster than reading HID spec PDFs.

---

## Useful Commands
```bash
# Development
npm start                     # Start Node server (or `npm run dev` for debug logs)
npm run simulate              # Run with simulated controller
npm test                      # Run unit tests

# Mapping & Calibration
npm run auto-map              # Interactive auto-mapper (guides you through button presses)
npm run map                   # Raw byte diff viewer (for manual mapping)
node server/collect_samples.js --label cross --count 3  # Collect labeled samples

# Python Backend
. .venv/bin/activate && python3 python/server.py  # Run Python server
npm run test:py               # Run Python unit tests (pytest)
```

---

## Troubleshooting

### "LIBUSB_ERROR_ACCESS" or Permission Denied
**macOS**: System Preferences → Security & Privacy → Input Monitoring → grant Terminal/IDE permission  
**Linux**: Add udev rule for DS4 (example: `/etc/udev/rules.d/50-ds4.rules`)
```
SUBSYSTEM=="usb", ATTRS{idVendor}=="054c", ATTRS{idProduct}=="05c4", MODE="0666"
```
Then: `sudo udevadm control --reload-rules && sudo udevadm trigger`

### "Cannot find module 'node-hid'"
Run `npm install` again. If it fails to build, install build tools:
- **macOS**: `xcode-select --install`
- **Linux**: `sudo apt-get install build-essential libudev-dev`

### WebSocket Connection Fails
Check that the server is running on `http://localhost:8080` and firewall isn't blocking it. Try opening the server URL directly in a browser first.

### Buttons Not Detected
1. Run with `MAP=1` to see byte diffs
2. Use `npm run auto-map` to regenerate `.ds4map.json`
3. Check `.ds4map.example.json` for reference mappings

---

## The Unexpected Gem ✨

You made it this far. Here's the secret: **ControlUniversal is a translation layer between physics and electrons.**

Every time you press a button, you're compressing a spring, closing a circuit, changing a voltage, triggering an ADC sample, encoding it into a USB packet, traversing kernel drivers, landing in userspace, getting parsed by JavaScript, serialized to JSON, sent over a WebSocket, decoded by a browser, and finally... lighting up an SVG circle.

All of that happens in ~5 milliseconds.

**That's not just code. That's a bridge between your nervous system and the digital void.**

So yeah, this repo decodes DualShock 4 packets. But really? It's about making the invisible visible. Every project that translates one domain into another—MIDI, OSC, HTTP, WebSockets, whatever—is doing the same thing: **building interfaces between worlds that don't naturally speak.**

If you fork this, don't just add features. Ask: *What other worlds can I connect?*

---

## Keyboard Shortcuts (WebUI)
- **Enter**: Accept modal dialog / confirm action
- **Escape**: Close modal or cancel current dialog
- **Click calibration icon (top-right)**: Open sensor detection overlay

The WebUI uses ARIA attributes (`role="dialog"`, `aria-labelledby`, `aria-describedby`) for screen reader compatibility.

---

## Contributing

This project thrives on **weird, ambitious ideas**. Here's what we care about:

1. **Does it expand the frontier?** (New controller support, output bridges, sensor fusion, etc.)
2. **Does it reduce cognitive load?** (Better docs, clearer errors, simpler APIs)
3. **Does it work immediately?** (No 47-step setup guides)

Before submitting a PR:
- Run `npm test` (or `npm run test:py`) to ensure tests pass
- Update `README.md` if adding new features
- Use `SIMULATE=1` mode to write deterministic tests
- Keep the philosophy: **Physical → Digital should feel like magic, not archaeology.**

---

## License

MIT — See [LICENSE](LICENSE) file.

---

## Philosophy

**ControlUniversal** is a bridge between the physical and digital. It's about translation, not just parsing.

Every controller is a language. Every button press is a sentence. This project teaches computers to listen.

If you build something wild with this, [let me know](https://github.com/Blackmvmba88/controluniversal88/issues). I want to see where this goes.
