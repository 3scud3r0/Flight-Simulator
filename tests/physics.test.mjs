import test from "node:test";
import assert from "node:assert/strict";
import {
  AIRCRAFT, createFlight, stepFlight, clamp, rad, deg, normalizeHeading
} from "../src/physics.js";
import {
  AIRPORTS, LANDMARKS, geo, toGeo, sampleHeight, isLand, shorelineLatitude
} from "../src/legacy/world.js";

test("all aircraft define physically meaningful and finite parameters", () => {
  for (const a of Object.values(AIRCRAFT)) {
    for (const key of ["mass", "wingArea", "wingspan", "length", "thrust", "rotationSpeed"]) {
      assert.ok(Number.isFinite(a[key]) && a[key] > 0, `${a.id}: ${key}`);
    }
    assert.ok(a.maxSpeed > a.rotationSpeed);
  }
});
test("geographic projection round trips within floating point tolerance", () => {
  for (const airport of AIRPORTS) {
    const converted = toGeo(...Object.values(geo(airport.lat, airport.lon)));
    assert.ok(Math.abs(converted.lat - airport.lat) < 1e-9);
    assert.ok(Math.abs(converted.lon - airport.lon) < 1e-9);
  }
});
test("SBRJ has two published-length approximate runways", () => {
  const rio = AIRPORTS.find(a => a.id === "SBRJ");
  assert.deepEqual(rio.runways.map(r => r.length), [1323, 1260]);
  assert.ok(LANDMARKS.length >= 5);
});
test("airports sit on positive elevation including reclaimed bay land", () => {
  for (const airport of AIRPORTS) {
    const p = geo(airport.lat, airport.lon);
    assert.ok(sampleHeight(p.x, p.z) > 0, airport.id);
  }
});
test("Rio shoreline retains land and ocean near Copacabana", () => {
  const lon = -43.18, coast = shorelineLatitude(lon);
  assert.equal(isLand(...Object.values(geo(coast + .006, lon))), true);
  assert.equal(isLand(...Object.values(geo(coast - .006, lon))), false);
});
test("throttle clamps and heading stays normalized", () => {
  const state = createFlight("cessna", { heading: 100 });
  for (let i = 0; i < 120; i++) {
    stepFlight(state, { throttleDelta: 100, aileron: 1 }, 1 / 60, 0);
  }
  assert.equal(state.throttle, 1);
  assert.ok(state.heading >= 0 && state.heading < 2 * Math.PI);
  assert.ok(Number.isFinite(state.y) && Number.isFinite(state.speed));
  assert.equal(clamp(-7, 0, 1), 0);
  assert.ok(Math.abs(deg(rad(90)) - 90) < 1e-10);
  assert.ok(normalizeHeading(-2) > 0);
});
test("a stopped airplane settles on terrain without underground penetration", () => {
  const state = createFlight("cessna", { y: 1, speed: 0, heading: 0 });
  state.throttle = 0;
  stepFlight(state, {}, 1 / 60, 3);
  assert.equal(state.onGround, true);
  assert.ok(state.y >= 3 + AIRCRAFT.cessna.clearance);
  assert.equal(state.verticalSpeed, 0);
});
test("simulation is deterministic for a fixed sequence of inputs", () => {
  const a = createFlight("twin");
  const b = createFlight("twin");
  for (let i = 0; i < 350; i++) {
    const input = { elevator: i < 120 ? .14 : -.02,
      aileron: i < 220 ? .22 : 0, throttleDelta: -.03 };
    stepFlight(a, input, 1 / 60, 0);
    stepFlight(b, input, 1 / 60, 0);
  }
  assert.deepEqual(a, b);
  assert.ok(a.distance > 0);
});
test("nonpositive or invalid timestep does not modify state", () => {
  const state = createFlight();
  const snapshot = structuredClone(state);
  stepFlight(state, { elevator: 1 }, 0);
  stepFlight(state, { elevator: 1 }, NaN);
  assert.deepEqual(state, snapshot);
});

test("a slow frame integrates the entire interval in stable substeps", () => {
  const slow = createFlight("cessna");
  const fixed = createFlight("cessna");
  const input = { elevator: .3, aileron: -.25, throttleDelta: -.1 };
  stepFlight(slow, input, 1 / 6, 0);
  for (let i = 0; i < 5; i++) stepFlight(fixed, input, 1 / 30, 0);
  assert.deepEqual(slow, fixed);
  assert.ok(slow.distance > createFlight("cessna").speed / 10);
});

test("wheels resist crosswind while parked and elevator rotates at takeoff speed", () => {
  const a = AIRCRAFT.cessna;
  const parked = createFlight("cessna", { y: a.clearance, speed: 0 });
  parked.onGround = true;
  parked.throttle = 0;
  stepFlight(parked, { windX: 30, windZ: -20, elevator: 1 }, 1, 0);
  assert.equal(parked.x, 0);
  assert.equal(parked.z, 0);
  assert.ok(parked.pitch < .02);

  const departure = createFlight("cessna", { y: a.clearance, speed: 0 });
  departure.onGround = true;
  departure.throttle = 1;
  for (let i = 0; i < 2400 && departure.onGround; i++) {
    stepFlight(departure, { elevator: .75 }, 1 / 60, 0);
  }
  assert.equal(departure.onGround, false);
  assert.ok(departure.speed >= a.rotationSpeed * .72);
  assert.equal(departure.damaged, false);
});

test("touchdown distinguishes gentle landing and excessive descent", () => {
  for (const [descent, damaged] of [[-2, false], [-8, true]]) {
    const state = createFlight("cessna", { y: 2.2, speed: 25 });
    state.verticalSpeed = descent;
    state.throttle = 0;
    for (let i = 0; i < 60 && !state.onGround; i++) {
      stepFlight(state, { elevator: .2 }, 1 / 60, 0);
    }
    assert.equal(state.onGround, true);
    assert.equal(state.damaged, damaged);
    assert.equal(state.y, AIRCRAFT.cessna.clearance);
    assert.equal(state.verticalSpeed, 0);
  }
});

test("a gentle elevator flare reduces descent before touchdown", () => {
  const plain = createFlight("cessna", { y: 8, speed: 34 });
  plain.verticalSpeed = -3;
  plain.throttle = 0;
  const flare = structuredClone(plain);
  for (let i = 0; i < 45; i++) {
    stepFlight(plain, {}, 1 / 60, 0);
    stepFlight(flare, { elevator: .5 }, 1 / 60, 0);
  }
  assert.ok(flare.verticalSpeed > plain.verticalSpeed + .5);
  assert.ok(flare.y > plain.y);
  assert.equal(flare.damaged, false);
});
