(function () {
  // Pure mapping helpers for keyboard -> input messages
  // Exports a small API usable both in browser and Node tests.

  const KEY_TO_AXIS = {
    ArrowUp: { id: 'throttle', value: 1 },
    ArrowDown: { id: 'throttle', value: -1 },
    ArrowLeft: { id: 'yaw', value: -1 },
    ArrowRight: { id: 'yaw', value: 1 },
  };

  function keyMessageFor(key, down) {
    const m = KEY_TO_AXIS[key];
    if (!m) return null;
    return { type: 'axis', id: m.id, value: down ? m.value : 0 };
  }

  function applyKeyState(state, key, down) {
    // state is a map id -> value. Mutates and returns messages to send.
    const msg = keyMessageFor(key, down);
    if (!msg) return [];
    const prev = state[msg.id] || 0;
    const next = msg.value;
    state[msg.id] = next;
    if (prev === next) return [];
    return [msg];
  }

  // Export
  const api = { keyMessageFor, applyKeyState, KEY_TO_AXIS };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.KeyboardMap = api;
})();
