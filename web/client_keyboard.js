(function () {
  const WS_URL = (location.protocol === 'https:' ? 'wss' : 'ws') + '://' + location.host;
  let ws = null;
  function createWS() {
    ws = new WebSocket(WS_URL);
    ws.addEventListener('open', () => console.log('KB WS open'));
    ws.addEventListener('close', () => {
      console.log('KB WS closed, reconnecting in 1s');
      setTimeout(createWS, 1000);
    });
    ws.addEventListener('error', (e) => console.warn('KB WS err', e));
  }
  try {
    createWS();
  } catch (e) {
    console.warn('KB ws create failed', e);
  }

  // Use the pure mapping helper if available
  const KM = typeof window !== 'undefined' && window.KeyboardMap ? window.KeyboardMap : null;

  const KEY_TO_AXIS = KM
    ? KM.KEY_TO_AXIS
    : {
        ArrowUp: { id: 'throttle', value: 1 },
        ArrowDown: { id: 'throttle', value: -1 },
        ArrowLeft: { id: 'yaw', value: -1 },
        ArrowRight: { id: 'yaw', value: 1 },
      };

  // Map arrow keys to a single synthetic button id 'f18'
  const KEY_TO_BUTTON = KM
    ? KM.KEY_TO_BUTTON
    : {
        ArrowUp: 'f18',
        ArrowDown: 'f18',
        ArrowLeft: 'f18',
        ArrowRight: 'f18',
      };

  // current axis & button state
  const axisState = {}; // id -> value
  const buttonState = {}; // id -> 0/1
  let enabled = false;

  // Polling frequency for axis updates (reduced to lower CPU/WS churn)
  const pollHz = 20;
  let lastSent = {};
  let lastSentButton = {};

  function sendMsg(m) {
    try {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
    } catch (e) {
      /* ignore */
    }
  }

  function tick() {
    if (!enabled) return;
    Object.keys(axisState).forEach((id) => {
      const v = axisState[id] || 0;
      const prev = lastSent[id];
      if (prev !== v) {
        lastSent[id] = v;
        sendMsg({ type: 'axis', id, value: v });
        updateAxisDisplay();
      }
    });
  }

  const interval = setInterval(tick, 1000 / pollHz);

  function updateAxisDisplay() {
    const el = document.getElementById('axis-display');
    if (!el) return;
    const txt = Object.keys(axisState)
      .map((k) => `${k}: ${axisState[k].toFixed ? axisState[k].toFixed(2) : axisState[k]}`)
      .join(' ');
    if (el.innerText !== txt) el.innerText = txt;
  }

  function handleButtonPress(id) {
    const prev = buttonState[id] || 0;
    if (prev === 1) return;
    buttonState[id] = 1;
    lastSentButton[id] = undefined;
    // send immediate button press
    sendMsg({ type: 'button', id, value: 1 });
  }
  function handleButtonRelease(id) {
    const prev = buttonState[id] || 0;
    if (prev === 0) return;
    buttonState[id] = 0;
    lastSentButton[id] = undefined;
    sendMsg({ type: 'button', id, value: 0 });
  }

  function onKeyDown(e) {
    if (!enabled) return;
    let handled = false;
    if (KEY_TO_AXIS[e.key]) {
      handled = true;
      e.preventDefault();
      const cfg = KEY_TO_AXIS[e.key];
      const prev = axisState[cfg.id] || 0;
      axisState[cfg.id] = cfg.value;
      if (prev !== cfg.value) {
        lastSent[cfg.id] = undefined;
      }
    }
    if (KEY_TO_BUTTON[e.key]) {
      handled = true;
      e.preventDefault();
      handleButtonPress(KEY_TO_BUTTON[e.key]);
    }
    if (handled) return;
  }
  function onKeyUp(e) {
    if (!enabled) return;
    let handled = false;
    if (KEY_TO_AXIS[e.key]) {
      handled = true;
      e.preventDefault();
      const cfg = KEY_TO_AXIS[e.key];
      const prev = axisState[cfg.id] || 0;
      axisState[cfg.id] = 0;
      if (prev !== 0) {
        lastSent[cfg.id] = undefined;
      }
    }
    if (KEY_TO_BUTTON[e.key]) {
      handled = true;
      e.preventDefault();
      handleButtonRelease(KEY_TO_BUTTON[e.key]);
    }
    if (handled) return;
  }

  document.addEventListener('keydown', onKeyDown, { passive: false });
  document.addEventListener('keyup', onKeyUp, { passive: false });

  // Toggling control via UI checkbox
  function initToggle() {
    const cb = document.getElementById('kb-enable');
    if (!cb) return;
    cb.addEventListener('change', (e) => {
      enabled = !!cb.checked;
      if (!enabled) {
        // reset state
        Object.keys(axisState).forEach((k) => {
          axisState[k] = 0;
          lastSent[k] = undefined;
        });
        Object.keys(buttonState).forEach((k) => {
          buttonState[k] = 0;
          lastSentButton[k] = undefined;
        });
        updateAxisDisplay();
      }
    });
  }
  setTimeout(initToggle, 50);

  // Expose for testability
  if (typeof window !== 'undefined')
    window._kb = {
      KEY_TO_AXIS,
      KEY_TO_BUTTON,
      axisState,
      buttonState,
      enable: (v) => {
        enabled = !!v;
        const cb = document.getElementById('kb-enable');
        if (cb) cb.checked = !!v;
      },
    };
})();
