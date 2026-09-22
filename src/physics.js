/**
 * Rio Flight — deterministic, dependency-free, fixed-timestep flight model.
 * Coordinates: metres, X east, Y up, Z south. Angles in radians.
 * This is an educational aerodynamic approximation, not certified flight software.
 */
export const AIRCRAFT = Object.freeze({
  cessna: Object.freeze({
    id: "cessna", name: "Cessna 172 (inspirado)", className: "Aviação geral",
    mass: 1100, wingArea: 16.2, wingspan: 11, length: 8.3,
    thrust: 2050, cd0: 0.028, induced: 0.065, cl0: 0.24,
    liftSlope: 3.9, stallAoA: 0.29, maxCL: 1.45,
    rotationSpeed: 31, spawnSpeed: 54, maxSpeed: 90, clearance: 1.7,
    color: 0xf1f6ff, accent: 0xf59e0b
  }),
  twin: Object.freeze({
    id: "twin", name: "Turboélice regional (inspirado)", className: "Regional",
    mass: 17500, wingArea: 61, wingspan: 27, length: 22,
    thrust: 25500, cd0: 0.03, induced: 0.052, cl0: 0.32,
    liftSlope: 4.3, stallAoA: 0.27, maxCL: 1.6,
    rotationSpeed: 66, spawnSpeed: 100, maxSpeed: 175, clearance: 2.7,
    color: 0xffffff, accent: 0x06b6d4
  }),
  jet: Object.freeze({
    id: "jet", name: "Jato comercial (inspirado)", className: "Transporte",
    mass: 62000, wingArea: 122, wingspan: 35.8, length: 37.5,
    thrust: 126000, cd0: 0.025, induced: 0.045, cl0: 0.28,
    liftSlope: 4.6, stallAoA: 0.25, maxCL: 1.65,
    rotationSpeed: 75, spawnSpeed: 145, maxSpeed: 260, clearance: 3.8,
    color: 0xe9f3ff, accent: 0x38bdf8
  })
});

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const rad = degrees => degrees * Math.PI / 180;
export const deg = radians => radians * 180 / Math.PI;
export const normalizeHeading = radians => (radians % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);

export function createFlight(aircraftId = "cessna", spawn = {}) {
  const aircraft = AIRCRAFT[aircraftId] || AIRCRAFT.cessna;
  return {
    aircraftId: aircraft.id, x: spawn.x ?? 0, y: spawn.y ?? 260,
    z: spawn.z ?? 0, heading: spawn.heading ?? rad(20),
    pitch: 0.035, roll: 0, speed: spawn.speed ?? aircraft.spawnSpeed,
    verticalSpeed: 0, throttle: 0.76, flaps: 0, gear: true,
    trim: 0, fuel: 1, damaged: false, onGround: false,
    gLoad: 1, aoa: 0, stall: false, distance: 0
  };
}

/**
 * Integrates forces and pilot inputs in <= 1/30 s increments.
 * Input axes range from -1 to 1; throttleDelta is per-second.
 * Terrain elevation must be expressed in the same metres as state.y.
 */
export function stepFlight(state, input = {}, dt = 1 / 60, terrainElevation = 0) {
  if (!Number.isFinite(dt) || dt <= 0) return state;
  const a = AIRCRAFT[state.aircraftId] || AIRCRAFT.cessna;
  const h = clamp(dt, 0, 1 / 30);
  const elevator = clamp(input.elevator || 0, -1, 1);
  const aileron = clamp(input.aileron || 0, -1, 1);
  const rudder = clamp(input.rudder || 0, -1, 1);
  state.throttle = clamp(state.throttle + (input.throttleDelta || 0) * h, 0, 1);
  state.trim = clamp(state.trim + (input.trimDelta || 0) * h, -1, 1);

  const authority = clamp(state.speed / Math.max(a.rotationSpeed, 1), 0.2, 1.4);
  state.pitch = clamp(state.pitch + (elevator * 0.43 * authority +
    state.trim * 0.075 - state.pitch * 0.055) * h, -0.37, 0.40);
  state.roll = clamp(state.roll + (aileron * 0.92 * authority -
    state.roll * 0.13) * h, -1.25, 1.25);

  const rho = 1.225 * Math.exp(-Math.max(0, state.y) / 8500);
  const flightPathAngle = Math.atan2(state.verticalSpeed, Math.max(state.speed, 5));
  state.aoa = state.pitch - flightPathAngle + 0.018;
  const stalled = Math.abs(state.aoa) > a.stallAoA;
  let cl = clamp(a.cl0 + a.liftSlope * state.aoa + state.flaps * 0.31,
    -0.8, a.maxCL);
  if (stalled) cl *= clamp(1 - (Math.abs(state.aoa) - a.stallAoA) * 3.1, 0.22, 1);
  state.stall = stalled && state.speed > 12;

  const q = 0.5 * rho * state.speed * state.speed;
  const lift = q * a.wingArea * cl;
  const drag = q * a.wingArea * (
    a.cd0 + a.induced * cl * cl + (state.gear ? 0.016 : 0) +
    state.flaps * 0.055);
  const thrust = a.thrust * state.throttle * (state.fuel > 0 ? 1 : 0);
  const braking = input.brake && state.onGround ? a.mass * 3.3 : 0;
  // Only arcade challenge mode supplies boostAcceleration. Free flight stays unchanged.
  const arcadeBoost = clamp(Number(input.boostAcceleration) || 0, 0, 15);
  const forwardAcceleration = (thrust - drag - braking) / a.mass -
    9.81 * Math.sin(flightPathAngle) + (state.onGround ? 0 : arcadeBoost);
  state.speed = clamp(state.speed + forwardAcceleration * h, 0,
    arcadeBoost > 0 ? a.maxSpeed * 1.65 :
      Math.max(a.maxSpeed * 1.16, state.speed));
  const verticalAcceleration = lift * Math.cos(state.roll) / a.mass - 9.81;
  state.gLoad = lift / (a.mass * 9.81);
  state.verticalSpeed = clamp(state.verticalSpeed +
    clamp(verticalAcceleration, -20, 20) * h, -95, 95);

  const floor = terrainElevation + (state.gear ? a.clearance : a.clearance * 0.48);
  if (state.y <= floor + 0.03 && state.verticalSpeed <= 0) {
    if (state.verticalSpeed < -7 || (!state.gear && state.speed > 15)) {
      state.damaged = true;
    }
    state.y = floor;
    state.verticalSpeed = 0;
    state.onGround = true;
    state.roll *= Math.max(0, 1 - h * 2);
    state.pitch *= Math.max(0, 1 - h * 0.7);
  } else {
    state.y += state.verticalSpeed * h;
    if (state.y < floor) {
      if (state.verticalSpeed < -7 || !state.gear) state.damaged = true;
      state.y = floor;
      state.verticalSpeed = 0;
      state.onGround = true;
    } else {
      state.onGround = false;
    }
  }

  const turnRate = state.onGround
    ? rudder * clamp(state.speed / 18, 0, 1) * 0.28
    : 9.81 * Math.tan(state.roll) / Math.max(state.speed, 22) + rudder * 0.1;
  state.heading = normalizeHeading(state.heading + turnRate * h);
  const horizontalSpeed = Math.sqrt(Math.max(0,
    state.speed * state.speed - state.verticalSpeed * state.verticalSpeed));
  const windX = Number(input.windX) || 0;
  const windZ = Number(input.windZ) || 0;
  state.x += (Math.sin(state.heading) * horizontalSpeed + windX) * h;
  state.z -= (Math.cos(state.heading) * horizontalSpeed - windZ) * h;
  state.distance += horizontalSpeed * h;
  state.fuel = clamp(state.fuel - state.throttle * h / 36000, 0, 1);
  return state;
}
