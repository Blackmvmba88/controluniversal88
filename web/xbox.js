const state = {
  gamepadIdx: null,
  lastTime: performance.now(),
  frameCount: 0,
  pollingRate: 0,
  wsSource: false,
};

const elements = {
  noController: document.getElementById('no-controller-msg'),
  statusBadge: document.getElementById('status-badge'),
  controllerId: document.getElementById('controller-id'),
  pollingRate: document.getElementById('polling-rate'),
  lsDot: document.getElementById('ls-dot'),
  rsDot: document.getElementById('rs-dot'),
  lsCoords: document.getElementById('ls-coords'),
  rsCoords: document.getElementById('rs-coords'),
  ltVal: document.getElementById('lt-val'),
  rtVal: document.getElementById('rt-val'),
  ltFill: document.getElementById('lt-fill'),
  rtFill: document.getElementById('rt-fill'),
  vibrationBtn: document.getElementById('vibration-btn'),
  connectionMode: document.getElementById('connection-mode'),
  debugLog: document.getElementById('debug-log'),
};

const buttons = document.querySelectorAll('.btn-viz');

window.addEventListener('gamepadconnected', (e) => {
  console.log(
    'Gamepad connected at index %d: %s. %d buttons, %d axes.',
    e.gamepad.index,
    e.gamepad.id,
    e.gamepad.buttons.length,
    e.gamepad.axes.length
  );
  state.gamepadIdx = e.gamepad.index;
  updateStatus(true, e.gamepad.id);
});

window.addEventListener('gamepaddisconnected', (e) => {
  console.log('Gamepad disconnected from index %d', e.gamepad.index);
  if (state.gamepadIdx === e.gamepad.index) {
    state.gamepadIdx = null;
    updateStatus(false);
  }
});

function updateStatus(connected, id = '') {
  if (connected) {
    elements.noController.style.display = 'none';
    elements.statusBadge.innerText = 'Conectado';
    elements.statusBadge.className = 'status-badge status-connected';
    elements.controllerId.innerText = id.split(' (')[0];
  } else {
    elements.noController.style.display = 'flex';
    elements.statusBadge.innerText = 'Desconectado';
    elements.statusBadge.className = 'status-badge status-disconnected';
    elements.controllerId.innerText = 'N/A';
    elements.pollingRate.innerText = '0 Hz';
  }
}

function updateGamepad() {
  if (state.wsSource) {
    requestAnimationFrame(updateGamepad);
    return;
  }

  if (state.gamepadIdx === null) {
    // Fallback: check all gamepads if one was missed
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i]) {
        state.gamepadIdx = i;
        updateStatus(true, gamepads[i].id);
        break;
      }
    }
  }

  if (state.gamepadIdx !== null) {
    const gp = navigator.getGamepads()[state.gamepadIdx];
    if (!gp) {
      state.gamepadIdx = null;
      updateStatus(false);
      requestAnimationFrame(updateGamepad);
      return;
    }

    // Calculate polling rate
    state.frameCount++;
    const now = performance.now();
    if (now - state.lastTime >= 1000) {
      state.pollingRate = state.frameCount;
      elements.pollingRate.innerText = `${state.pollingRate} Hz`;
      state.frameCount = 0;
      state.lastTime = now;
    }

    // Update buttons
    gp.buttons.forEach((btn, i) => {
      updateButtonUI(i, btn.pressed);
    });

    // Update Sticks
    const axes = gp.axes;
    updateStickUI('ls', axes[0], axes[1]);
    updateStickUI('rs', axes[2], axes[3]);

    // Triggers
    updateTriggerUI('lt', gp.buttons[6].value);
    updateTriggerUI('rt', gp.buttons[7].value);
  }

  requestAnimationFrame(updateGamepad);
}

// Modular UI Update Functions
function updateButtonUI(id, pressed) {
  // Map numerical IDs to names if needed, or use data-btn attribute
  const el = document.querySelector(`.btn-viz[data-btn="${id}"]`);
  if (el) {
    if (pressed) el.classList.add('active');
    else el.classList.remove('active');
  }

  // Some buttons might be identified by name (WebSocket source)
  const namedEl = document.getElementById(`btn-${id}`);
  if (namedEl) {
    if (pressed) namedEl.classList.add('active');
    else namedEl.classList.remove('active');
  }

  // Special case for D-Pad IDs in the SVG (btn-12 to btn-15)
  if (typeof id === 'number' && id >= 12 && id <= 15) {
    const dpadEl = document.getElementById(`btn-${id}`);
    if (dpadEl) {
      if (pressed) dpadEl.style.fill = 'var(--xbox-green)';
      else dpadEl.style.fill = '#111';
    }
  }

  // Explicit named D-Pad for WebSocket
  const dpadIds = { dpad_up: 12, dpad_down: 13, dpad_left: 14, dpad_right: 15 };
  if (id in dpadIds) {
    const dpadEl = document.getElementById(`btn-${dpadIds[id]}`);
    if (dpadEl) {
      if (pressed) dpadEl.style.fill = 'var(--xbox-green)';
      else dpadEl.style.fill = '#111';
    }
  }
}

function updateStickUI(stick, x, y) {
  const dot = elements[`${stick}Dot`];
  const coords = elements[`${stick}Coords`];
  const top = document.getElementById(`${stick}-top`);

  if (dot) {
    dot.style.left = `${50 + x * 45}%`;
    dot.style.top = `${50 + y * 45}%`;
  }
  if (coords) {
    coords.innerText = `${stick.toUpperCase()}: ${x.toFixed(3)}, ${y.toFixed(3)}`;
  }
  if (top) {
    const baseX = stick === 'ls' ? 240 : 500;
    const baseY = stick === 'ls' ? 210 : 310;
    top.setAttribute('cx', baseX + x * 15);
    top.setAttribute('cy', baseY + y * 15);
  }
}

function updateTriggerUI(side, value) {
  const valEl = elements[`${side}Val`];
  const fillEl = elements[`${side}Fill`];
  if (valEl) valEl.innerText = `${Math.round(value * 100)}%`;
  if (fillEl) fillEl.style.width = `${value * 100}%`;
}

// WebSocket Integration
const WS_URL = (location.protocol === 'https:' ? 'wss' : 'ws') + '://' + location.host;
const ws = new WebSocket(WS_URL);

ws.onopen = () => console.log('WS Bridge Connected');
ws.onmessage = (m) => {
  try {
    const msg = JSON.parse(m.data);
    // If we receive server data, switch to WS mode for this session
    if (!state.wsSource && (msg.type === 'button' || msg.type === 'axis')) {
      state.wsSource = true;
      updateStatus(true, 'Server-Bridge (Wired)');
      if (elements.connectionMode) elements.connectionMode.innerText = 'Server Bridge (HID)';
      if (elements.debugLog) {
        elements.debugLog.style.display = 'block';
        elements.debugLog.innerText += `\n[BRIDGE] Detected hardware via server`;
      }
    }

    if (msg.type === 'button') {
      const id = msg.id;
      // Map common DS4/Server names to Xbox IDs if possible
      const map = {
        cross: 0,
        circle: 1,
        square: 2,
        triangle: 3,
        l1: 4,
        r1: 5,
        share: 8,
        options: 9,
        lstick: 10,
        rstick: 11,
        ps: 16,
        l2_btn: 6,
        r2_btn: 7,
      };
      const btnIdx = map[id] !== undefined ? map[id] : id;
      updateButtonUI(btnIdx, msg.value === 1);
    } else if (msg.type === 'axis') {
      if (msg.id === 'lstick_x' || msg.id === 'lstick_y') {
        state.ls = state.ls || { x: 0, y: 0 };
        if (msg.id === 'lstick_x') state.ls.x = msg.value;
        else state.ls.y = msg.value;
        updateStickUI('ls', state.ls.x, state.ls.y);
      } else if (msg.id === 'rstick_x' || msg.id === 'rstick_y') {
        state.rs = state.rs || { x: 0, y: 0 };
        if (msg.id === 'rstick_x') state.rs.x = msg.value;
        else state.rs.y = msg.value;
        updateStickUI('rs', state.rs.x, state.rs.y);
      } else if (msg.id === 'l2') {
        updateTriggerUI('lt', msg.value);
      } else if (msg.id === 'r2') {
        updateTriggerUI('rt', msg.value);
      }
    }
  } catch (e) {}
};

elements.vibrationBtn.addEventListener('click', () => {
  if (state.gamepadIdx !== null) {
    const gp = navigator.getGamepads()[state.gamepadIdx];
    if (gp && gp.vibrationActuator) {
      gp.vibrationActuator.playEffect('dual-rumble', {
        startDelay: 0,
        duration: 500,
        weakMagnitude: 1.0,
        strongMagnitude: 1.0,
      });
    } else {
      alert('Tu navegador o mando no soporta vibración (Haptic Feedback) via API.');
    }
  }
});

requestAnimationFrame(updateGamepad);
