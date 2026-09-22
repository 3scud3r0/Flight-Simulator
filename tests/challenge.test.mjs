import test from "node:test";
import assert from "node:assert/strict";
import {
  createCourse, createChallenge, crossing, stepChallenge,
  RING_COUNT, BOOST_DURATION, RING_RADIUS
} from "../src/challenge.js";
import { readGamepad, deadZone, chooseGamepad } from "../src/gamepad.js";
import { createFlight, stepFlight, AIRCRAFT } from "../src/physics.js";

function ring(x = 10, radius = RING_RADIUS) {
  return { x, y: 100, z: 0, radius, normal: { x: 1, y: 0, z: 0 } };
}
const before = (x = 0, y = 100) => ({ x, y, z: 0, speed: 70 });
const after = (x = 20, y = 100) => ({ x, y, z: 0, speed: 70 });

test("course has finite, correctly ordered aerial rings above terrain", () => {
  const origin = { x: 0, y: 750, z: 0, heading: Math.PI / 2 };
  const rings = createCourse(origin, () => 400);
  assert.equal(rings.length, RING_COUNT);
  for (let i = 0; i < rings.length; i++) {
    const r = rings[i];
    assert.equal(r.index, i);
    assert.equal(r.radius, RING_RADIUS);
    assert.ok(r.y >= 570);
    assert.ok(Math.abs(Math.hypot(r.normal.x, r.normal.z) - 1) < 1e-12);
    assert.ok(Number.isFinite(r.x) && Number.isFinite(r.y));
    if (i) assert.ok(r.x > rings[i - 1].x);
  }
});
test("ring intersects only from back to front and inside radius", () => {
  const gate = ring();
  assert.equal(crossing(before(), after(), gate)?.inside, true);
  assert.equal(crossing(after(), before(), gate), null);
  assert.equal(crossing(before(), before(9), gate), null);
  assert.equal(crossing(before(0, 220), after(20, 220), gate)?.inside, false);
});
test("segment-plane intersection prevents high-speed tunneling", () => {
  assert.equal(crossing(before(-900), after(900), ring())?.inside, true);
});
test("success awards speed points, combo, and a temporary boost once", () => {
  const challenge = createChallenge([ring()]);
  const events = stepChallenge(challenge, before(), after(), 1 / 60);
  assert.deepEqual(events.map(e => e.type), ["hit", "complete"]);
  assert.ok(challenge.score >= 100);
  assert.equal(challenge.passed, 1);
  assert.equal(challenge.combo, 1);
  assert.equal(challenge.status, "complete");
  assert.equal(stepChallenge(challenge, before(), after(), 1 / 60).length, 0);
});
test("missed gates reset combo and do not award points", () => {
  const challenge = createChallenge([ring(10), ring(30), ring(50)]);
  stepChallenge(challenge, before(), after(), .1);
  stepChallenge(challenge, before(20, 200), after(40, 200), .1);
  assert.equal(challenge.passed, 1);
  assert.equal(challenge.missed, 1);
  assert.equal(challenge.combo, 0);
  assert.equal(challenge.boostLeft, 0);
});
test("speed bonus and combo multiplier increase earned points", () => {
  const slow = createChallenge([ring()]);
  const fast = createChallenge([ring()]);
  stepChallenge(slow, before(), { ...after(), speed: 25 }, .01);
  stepChallenge(fast, before(), { ...after(), speed: 110 }, .01);
  assert.ok(fast.score > slow.score);
});
test("timed challenge expires once and cannot continue scoring", () => {
  const challenge = createChallenge([ring()], .2);
  assert.deepEqual(stepChallenge(challenge, before(), after(), .2)
    .map(e => e.type), ["timeout"]);
  assert.equal(challenge.score, 0);
  assert.equal(stepChallenge(challenge, before(), after(), .1).length, 0);
});
test("boost in physics is opt-in and bounded", () => {
  const normal = createFlight("cessna", { y: 1300, speed: 70 });
  const arcade = createFlight("cessna", { y: 1300, speed: 70 });
  for (let i = 0; i < 90; i++) {
    stepFlight(normal, {}, 1 / 60, 0);
    stepFlight(arcade, { boostAcceleration: 12 }, 1 / 60, 0);
  }
  assert.ok(arcade.speed > normal.speed);
  assert.ok(arcade.speed <= AIRCRAFT.cessna.maxSpeed * 1.65);
});
test("gamepad normalizes dead zone and keeps digital actions edge-triggered", () => {
  const pad = {
    id: "Standard Gamepad", connected: true,
    axes: [.05, .6, -.5],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }))
  };
  pad.buttons[0] = { pressed: true, value: 1 };
  pad.buttons[7] = { pressed: false, value: .6 };
  const first = readGamepad(pad);
  assert.deepEqual(first.actions, ["start"]);
  assert.equal(first.aileron, 0);
  assert.ok(first.elevator > 0 && first.rudder < 0);
  assert.ok(first.throttleDelta > 0);
  assert.deepEqual(readGamepad(pad, first.buttons).actions, []);
  assert.ok(readGamepad(pad, [], true).elevator < 0);
  assert.equal(deadZone(NaN), 0);
});
test("gamepad selection and disconnected fallback", () => {
  assert.equal(chooseGamepad([null, { connected: false }, { id: "USB" }]).id, "USB");
  assert.equal(chooseGamepad([null]), null);
  const disconnected = readGamepad(null);
  assert.equal(disconnected.connected, false);
  assert.equal(disconnected.throttleDelta, 0);
  assert.deepEqual(disconnected.actions, []);
});
test("temporary challenge boosts expire with the timer", () => {
  const challenge = createChallenge([ring(10), ring(30)]);
  stepChallenge(challenge, before(), after(), .01);
  assert.ok(challenge.boostLeft <= BOOST_DURATION);
  stepChallenge(challenge, before(20), before(21), BOOST_DURATION + 1);
  assert.equal(challenge.boostLeft, 0);
});
