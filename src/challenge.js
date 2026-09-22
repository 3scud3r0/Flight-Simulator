/**
 * Arcade challenge, independent of DOM and Three.js.
 * World convention: metres, +X east, +Y up, -Z north.
 * A ring is crossed only from its back to front and only once.
 */
export const RING_COUNT = 14;
export const COURSE_DURATION = 180;
export const BOOST_DURATION = 3.5;
export const RING_RADIUS = 47;

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

export function createCourse(origin, terrainHeight = () => 0) {
  if (!origin || !Number.isFinite(origin.heading)) {
    throw new TypeError("A valid aircraft spawn and heading are required");
  }
  const forward = {
    x: Math.sin(origin.heading), y: 0, z: -Math.cos(origin.heading)
  };
  const right = { x: Math.cos(origin.heading), y: 0, z: Math.sin(origin.heading) };
  const rings = [];
  for (let i = 0; i < RING_COUNT; i++) {
    const distance = 250 + i * 370;
    const lateral = 69 * Math.sin(i * 0.71) + 18 * Math.sin(i * 1.57);
    const x = origin.x + forward.x * distance + right.x * lateral;
    const z = origin.z + forward.z * distance + right.z * lateral;
    const y = Math.max(
      origin.y + 18 * Math.sin(i * 0.78),
      terrainHeight(x, z) + 170
    );
    rings.push({
      index: i, x, y, z, radius: RING_RADIUS,
      normal: { ...forward }
    });
  }
  return rings;
}

export function createChallenge(rings, duration = COURSE_DURATION) {
  if (!Array.isArray(rings) || rings.length === 0) {
    throw new TypeError("Course must contain at least one ring");
  }
  return {
    rings, next: 0, score: 0, combo: 0, passed: 0, missed: 0,
    timeLeft: duration, boostLeft: 0, status: "running",
    lastEvent: null
  };
}

/**
 * Tests a segment against the plane of the next ring.
 * Interpolating the intersection prevents skipping thin rings at high FPS variance.
 */
export function crossing(previous, current, ring) {
  const before = dot({
    x: previous.x - ring.x, y: previous.y - ring.y, z: previous.z - ring.z
  }, ring.normal);
  const after = dot({
    x: current.x - ring.x, y: current.y - ring.y, z: current.z - ring.z
  }, ring.normal);
  if (!(before <= 0 && after > 0)) return null;
  const t = clamp(-before / (after - before), 0, 1);
  const x = previous.x + (current.x - previous.x) * t - ring.x;
  const y = previous.y + (current.y - previous.y) * t - ring.y;
  const z = previous.z + (current.z - previous.z) * t - ring.z;
  // Project out depth so radius is independent of flight direction.
  const depth = x * ring.normal.x + y * ring.normal.y + z * ring.normal.z;
  const radial = Math.hypot(
    x - depth * ring.normal.x,
    y - depth * ring.normal.y,
    z - depth * ring.normal.z
  );
  return { inside: radial <= ring.radius, radial, t };
}

/**
 * Mutates only the challenge model; returns events for the UI/renderer.
 * Normal/free-flight physics never receives an arcade boost.
 */
export function stepChallenge(challenge, previous, current, dt) {
  if (challenge.status !== "running" || !Number.isFinite(dt) || dt <= 0) return [];
  const events = [];
  challenge.timeLeft = Math.max(0, challenge.timeLeft - dt);
  challenge.boostLeft = Math.max(0, challenge.boostLeft - dt);
  if (challenge.timeLeft <= 0) {
    challenge.status = "timeout";
    challenge.lastEvent = { type: "timeout" };
    return [challenge.lastEvent];
  }
  const ring = challenge.rings[challenge.next];
  if (!ring) return events;
  const crossed = crossing(previous, current, ring);
  if (!crossed) return events;
  challenge.next++;
  if (crossed.inside && !current.damaged) {
    challenge.passed++;
    challenge.combo = Math.min(5, challenge.combo + 1);
    const knots = Math.max(0, (current.speed || 0) * 1.943844);
    const base = 100 + Math.round(knots * 0.6);
    const speedBonus = knots >= 160 ? 125 : knots >= 100 ? 75 : 0;
    const gained = (base + speedBonus) * challenge.combo;
    challenge.score += gained;
    challenge.boostLeft = BOOST_DURATION;
    challenge.lastEvent = {
      type: "hit", gained, combo: challenge.combo, speedBonus, ring: challenge.next
    };
  } else {
    challenge.missed++;
    challenge.combo = 0;
    challenge.boostLeft = 0;
    challenge.lastEvent = { type: "miss", ring: challenge.next };
  }
  events.push(challenge.lastEvent);
  if (challenge.next === challenge.rings.length) {
    challenge.status = "complete";
    challenge.boostLeft = 0;
    challenge.lastEvent = {
      type: "complete", score: challenge.score, passed: challenge.passed,
      missed: challenge.missed, timeLeft: challenge.timeLeft
    };
    events.push(challenge.lastEvent);
  }
  return events;
}
