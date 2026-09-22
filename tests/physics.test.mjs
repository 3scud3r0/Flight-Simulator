import test from "node:test";
import assert from "node:assert/strict";
import {
  AIRCRAFT, createFlight, stepFlight, clamp, rad, deg, normalizeHeading
} from "../src/physics.js";
import {
  AIRPORTS, LANDMARKS, geo, toGeo, sampleHeight, isLand, shorelineLatitude
} from "../src/world.js";

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
