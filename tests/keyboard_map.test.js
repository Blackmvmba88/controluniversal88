const km = require('../web/keyboard_map.js');

module.exports = {
  'keyMessageFor produces axis messages': function () {
    const m = km.keyMessageFor('ArrowUp', true);
    if (!m) throw new Error('no message');
    if (m.type !== 'axis' || m.id !== 'throttle' || m.value !== 1)
      throw new Error('unexpected message');
  },
  'applyKeyState changes state and returns messages': function () {
    const state = {};
    const msgs = km.applyKeyState(state, 'ArrowLeft', true);
    if (!Array.isArray(msgs) || msgs.length !== 1) throw new Error('expected one message');
    if (state['yaw'] !== -1) throw new Error('state not updated');
    const msgs2 = km.applyKeyState(state, 'ArrowLeft', false);
    if (!Array.isArray(msgs2) || msgs2.length !== 1) throw new Error('expected message on release');
    if (state['yaw'] !== 0) throw new Error('state not reset');
  },
};
