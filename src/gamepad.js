/**
 * Browser Gamepad API adapter. Pure so button transitions and dead zones
 * can be tested without a browser or a physical controller.
 * Standard mapping (Xbox/PlayStation in modern browsers):
 * left stick X roll, left stick Y pitch, right stick X rudder,
 * RT/LT throttle, LB brake, A start, B gear, X flaps, Y camera,
 * Start pause, Select help, D-pad up/down throttle.
 */
export const DEAD_ZONE = 0.13;

export function deadZone(value, threshold = DEAD_ZONE) {
  if (!Number.isFinite(value)) return 0;
  const magnitude = Math.abs(value);
  if (magnitude <= threshold) return 0;
  return Math.sign(value) *
    Math.min(1, (magnitude - threshold) / (1 - threshold));
}

function pressed(button) {
  return Boolean(button && (button.pressed || button.value > 0.5));
}

function analog(button) {
  return Math.min(1, Math.max(0, Number(button?.value) || 0));
}

export function readGamepad(pad, previous = [], invertPitch = false) {
  if (!pad || pad.connected === false) {
    return { connected: false, buttons: [], actions: [],
      elevator: 0, aileron: 0, rudder: 0,
      throttleDelta: 0, brake: false };
  }
  const buttons = (pad.buttons || []).map(pressed);
  const edge = index => buttons[index] && !previous[index];
  const actions = [];
  for (const [index, action] of [
    [0, "start"], [1, "gear"], [2, "flaps"], [3, "camera"],
    [9, "pause"], [8, "help"]
  ]) if (edge(index)) actions.push(action);

  const axes = pad.axes || [];
  // Positive pitch means "nose up". Pulling the stick toward the player
  // is typically positive browser Y, mirroring the mobile virtual stick.
  return {
    connected: true,
    name: pad.id || "Controle USB / Bluetooth",
    buttons, actions,
    aileron: deadZone(Number(axes[0]) || 0),
    elevator: deadZone(Number(axes[1]) || 0) * (invertPitch ? -1 : 1),
    rudder: deadZone(Number(axes[2]) || 0),
    throttleDelta:
      (analog(pad.buttons?.[7]) - analog(pad.buttons?.[6])) * 0.70 +
      ((buttons[12] ? 1 : 0) - (buttons[13] ? 1 : 0)) * 0.40,
    brake: Boolean(buttons[4])
  };
}

export function chooseGamepad(pads) {
  if (!pads) return null;
  for (const pad of pads) {
    if (pad && pad.connected !== false) return pad;
  }
  return null;
}
