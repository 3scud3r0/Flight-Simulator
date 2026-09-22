import {
  AIRCRAFT, createFlight, stepFlight, clamp, rad, deg
} from "./physics.js";
import {
  AIRPORTS, LANDMARKS, geo, toGeo, sampleHeight, isLand, createWorld
} from "./world.js";

const $ = id => document.getElementById(id);
const loading = $("loading");
const canvas = $("scene");
let THREE;
try {
  THREE = await import("https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js");
} catch (firstError) {
  try {
    THREE = await import("https://unpkg.com/three@0.180.0/build/three.module.js");
  } catch (secondError) {
    loading.textContent = "Não foi possível carregar a biblioteca 3D. Verifique a internet e atualize a página.";
    throw secondError;
  }
}

let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: false, powerPreference: "high-performance"
  });
} catch (error) {
  loading.textContent = "WebGL indisponível. Atualize o navegador e ative a aceleração gráfica.";
  throw error;
}
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(64, 1, .6, 92000);
const clock = new THREE.Clock();
const world = createWorld(THREE, scene, renderer);
loading.classList.add("hidden");

let flight, aircraft, activeAircraft = $("aircraft").value;
let running = false, paused = false, helpWasPaused = false;
let cameraMode = 0, hour = Number($("time").value);
let mapVisible = true, audio = null, soundOn = false;
let frame = 0, frameElapsed = 0, accumulator = 0, mapTimer = 0;
const FIXED_STEP = 1 / 60;
const keys = new Set();
const touch = { aileron: 0, elevator: 0, rudder: 0 };
const temp = new THREE.Vector3();
const look = new THREE.Vector3();
const offset = new THREE.Vector3();
const forward = new THREE.Vector3();
const planePosition = new THREE.Vector3();
const mapCtx = $("map").getContext("2d");
const mapImage = document.createElement("canvas");
mapImage.width = mapImage.height = 320;
const mapBackground = mapImage.getContext("2d");
const MAP_SIZE = 62000;

function mesh(group, geometry, material, x = 0, y = 0, z = 0) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(x, y, z); item.castShadow = true;
  group.add(item); return item;
}
function makeAirplane(id) {
  const a = AIRCRAFT[id], group = new THREE.Group(), propellers = [];
  const body = new THREE.MeshStandardMaterial({ color: a.color, metalness: .25, roughness: .48 });
  const accent = new THREE.MeshStandardMaterial({ color: a.accent, metalness: .32, roughness: .44 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x172d3d, metalness: .3, roughness: .35 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x748697, metalness: .7, roughness: .35 });
  const length = a.length, span = a.wingspan;
  const radius = id === "jet" ? 1.9 : id === "twin" ? 1.18 : .49;
  const fuselage = mesh(group, new THREE.CylinderGeometry(radius * .84, radius, length * .85, 18), body);
  fuselage.rotation.x = Math.PI / 2;
  const nose = mesh(group, new THREE.ConeGeometry(radius * .88, length * .16, 18), body,
    0, 0, -length * .49);
  nose.rotation.x = -Math.PI / 2;
  const tailCap = mesh(group, new THREE.SphereGeometry(radius * .83, 12, 10), body,
    0, 0, length * .40);
  tailCap.scale.set(1, 1, 1.8);
  const wings = mesh(group, new THREE.BoxGeometry(span, id === "jet" ? .40 : .20,
    id === "jet" ? 4.7 : id === "twin" ? 3.0 : 1.45), body, 0, 0, .5);
  wings.rotation.y = -.045;
  for (const side of [-1, 1]) {
    const tip = mesh(group, new THREE.BoxGeometry(.6, .6, 1.55), accent,
      side * (span / 2 - .4), .3, 0);
    tip.rotation.z = side * .16;
  }
  const tail = mesh(group, new THREE.BoxGeometry(span * .29, .16, length * .13),
    body, 0, .50, length * .38);
  const fin = mesh(group, new THREE.BoxGeometry(.22,
    id === "jet" ? 4.7 : id === "twin" ? 3.15 : 1.5, length * .10),
    accent, 0, id === "jet" ? 2.45 : id === "twin" ? 1.65 : .81,
    length * .4);
  fin.rotation.x = -.19;
  const cockpit = mesh(group, new THREE.SphereGeometry(1, 18, 12), dark,
    0, radius * .48, -length * .25);
  cockpit.scale.set(radius * .82, radius * .52, length * .15);
  if (id === "jet") {
    for (const side of [-1, 1]) {
      const engine = mesh(group, new THREE.CylinderGeometry(.91, 1.1, 4.5, 12),
        steel, side * span * .29, -1.5, .8);
      engine.rotation.x = Math.PI / 2;
      const intake = mesh(group, new THREE.CylinderGeometry(.8, .8, .11, 12),
        dark, side * span * .29, -1.5, -1.49);
      intake.rotation.x = Math.PI / 2;
    }
  } else {
    const locations = id === "twin" ? [-span * .27, span * .27] : [0];
    for (const x of locations) {
      if (id === "twin") {
        const nacelle = mesh(group, new THREE.CylinderGeometry(.49, .49, 3.3, 12),
          body, x, -.20, -1);
        nacelle.rotation.x = Math.PI / 2;
      }
      const prop = mesh(group, new THREE.BoxGeometry(id === "twin" ? 3.1 : 2.3,
        .13, .13), dark, x, 0, id === "twin" ? -2.8 : -length * .58);
      propellers.push(prop);
      const hub = mesh(group, new THREE.SphereGeometry(.18, 8, 8), steel,
        x, 0, id === "twin" ? -2.8 : -length * .58);
      hub.scale.z = 2;
    }
  }
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x121a23, roughness: .95 });
  const gear = new THREE.Group();
  for (const [x, z, r] of [
    [-span * .11, 1.7, radius * .34],
    [span * .11, 1.7, radius * .34],
    [0, -length * .28, radius * .24]
  ]) {
    const leg = mesh(gear, new THREE.CylinderGeometry(.055, .055, radius * 2.3, 7),
      steel, x, -radius * .80, z);
    const wheel = mesh(gear, new THREE.CylinderGeometry(r, r, r * .39, 12),
      wheelMat, x, -radius * 1.8, z);
    wheel.rotation.z = Math.PI / 2;
  }
  group.add(gear); scene.add(group);
  return { group, propellers, gear, wings, materials: [body, accent, dark, steel, wheelMat] };
}
function disposeAirplane(model) {
  if (!model) return;
  scene.remove(model.group);
  model.group.traverse(object => {
    if (object.isMesh) object.geometry.dispose();
  });
  model.materials.forEach(m => m.dispose());
}
function spawn(runway = false) {
  activeAircraft = $("aircraft").value;
  const a = AIRCRAFT[activeAircraft];
  const airport = AIRPORTS.find(i => i.id === $("airport").value) || AIRPORTS[0];
  const p = geo(airport.lat, airport.lon);
  let options;
  if (runway) {
    const rw = airport.runways[0], heading = rad(rw.heading);
    options = {
      x: p.x + Math.cos(heading) * rw.offset - Math.sin(heading) * (rw.length / 2 - 170),
      z: p.z + Math.sin(heading) * rw.offset + Math.cos(heading) * (rw.length / 2 - 170),
      y: airport.elevation + a.clearance - .9,
      heading, speed: 0
    };
  } else if (airport.id === "SBRJ") {
    const panoramic = geo(-22.979, -43.227);
    options = { ...panoramic, y: 780, heading: rad(65) };
  } else {
    options = { x: p.x - 1900, z: p.z + 2200, y: 850, heading: rad(airport.heading) };
  }
  flight = createFlight(activeAircraft, options);
  if (runway) {
    flight.throttle = .13; flight.pitch = 0; flight.onGround = true;
  }
  disposeAirplane(aircraft);
  aircraft = makeAirplane(activeAircraft);
  updateAirplane();
  cameraMode = 0; updateCameraLabel();
  camera.position.copy(planePosition).add(new THREE.Vector3(0, 60, 130));
  accumulator = 0;
  $("touch-throttle").value = Math.round(flight.throttle * 100);
  $("aircraft-class").textContent = a.className.toUpperCase();
}
function updateAirplane() {
  aircraft.group.position.set(flight.x, flight.y, flight.z);
  aircraft.group.rotation.order = "YXZ";
  aircraft.group.rotation.set(flight.pitch, -flight.heading, -flight.roll);
  aircraft.gear.visible = flight.gear;
  for (const prop of aircraft.propellers) prop.rotation.z +=
    (11 + flight.throttle * 53) * FIXED_STEP;
  planePosition.copy(aircraft.group.position);
}
function updateCamera(dt) {
  const length = AIRCRAFT[activeAircraft].length;
  if (cameraMode === 0) {
    offset.set(0, 10 + length * .58, length * 3.5);
    offset.applyQuaternion(aircraft.group.quaternion);
    temp.copy(planePosition).add(offset);
    if (camera.position.distanceToSquared(temp) > 4000000) camera.position.copy(temp);
    else camera.position.lerp(temp, 1 - Math.exp(-dt * 3.5));
    look.copy(planePosition).add(new THREE.Vector3(0, length * .12, 0));
    camera.lookAt(look);
  } else if (cameraMode === 1) {
    offset.set(0, AIRCRAFT[activeAircraft].clearance * .75,
      -length * .25).applyQuaternion(aircraft.group.quaternion);
    camera.position.copy(planePosition).add(offset);
    forward.set(0, 0, -1).applyQuaternion(aircraft.group.quaternion);
    look.copy(camera.position).addScaledVector(forward, 350);
    camera.up.set(0, 1, 0).applyQuaternion(aircraft.group.quaternion);
    camera.lookAt(look);
  } else {
    const target = AIRPORTS.find(a => a.id === $("airport").value) || AIRPORTS[0];
    const p = geo(target.lat, target.lon);
    camera.position.set(p.x + 190, target.elevation + 38, p.z + 110);
    camera.lookAt(planePosition);
  }
  if (cameraMode !== 1) camera.up.set(0, 1, 0);
}
function updateCameraLabel() {
  $("camera-name").textContent = ["EXTERNA", "CABINE", "TORRE"][cameraMode];
}
function cycleCamera() {
  cameraMode = (cameraMode + 1) % 3; updateCameraLabel();
}
function togglePause() {
  paused = !paused;
  $("pause-name").textContent = paused ? "RETOMAR" : "PAUSAR";
  $("flight-status").textContent = paused ? "VOO PAUSADO" : "EM VOO";
}
function toggleHelp(open) {
  $("help-overlay").classList.toggle("hidden", !open);
  if (open) { helpWasPaused = paused; paused = true; }
  else paused = helpWasPaused;
  $("pause-name").textContent = paused ? "RETOMAR" : "PAUSAR";
  keys.clear();
}
function begin(runway = false) {
  spawn(runway); running = true; paused = false;
  $("welcome").classList.add("hidden");
  $("pause-name").textContent = "PAUSAR";
  $("flight-status").textContent = runway ? "PRONTO PARA DECOLAR" : "EM VOO";
}
function pilotInput() {
  const press = (...codes) => codes.some(code => keys.has(code));
  return {
    elevator: clamp((press("KeyW", "ArrowUp") ? 1 : 0) -
      (press("KeyS", "ArrowDown") ? 1 : 0) + touch.elevator, -1, 1),
    aileron: clamp((press("KeyD", "ArrowRight") ? 1 : 0) -
      (press("KeyA", "ArrowLeft") ? 1 : 0) + touch.aileron, -1, 1),
    rudder: clamp((press("KeyE") ? 1 : 0) -
      (press("KeyQ") ? 1 : 0) + touch.rudder, -1, 1),
    throttleDelta: (press("Equal", "NumpadAdd") ? .37 : 0) -
      (press("Minus", "NumpadSubtract") ? .37 : 0),
    brake: press("KeyB", "Space"),
    windX: $("weather").value === "vento" ? 5.5 : 0,
    windZ: $("weather").value === "vento" ? -3.8 : 0
  };
}
function buildMap() {
  const step = 4;
  for (let y = 0; y < 320; y += step) for (let x = 0; x < 320; x += step) {
    const wx = (x / 320 - .5) * MAP_SIZE;
    const wz = (y / 320 - .5) * MAP_SIZE;
    const h = sampleHeight(wx, wz);
    mapBackground.fillStyle = h < 0 ? "#155066" :
      h > 350 ? "#385f49" : h > 80 ? "#527f56" : "#71887a";
    mapBackground.fillRect(x, y, step, step);
  }
  mapBackground.strokeStyle = "#f0ce9c";
  mapBackground.lineWidth = 1;
  for (const a of AIRPORTS) {
    const p = mapXY(geo(a.lat, a.lon));
    mapBackground.beginPath(); mapBackground.arc(p.x, p.y, 4, 0, Math.PI * 2);
    mapBackground.fillStyle = "#ffda92"; mapBackground.fill();
    mapBackground.fillStyle = "#fff1c7";
    mapBackground.font = "bold 11px sans-serif";
    mapBackground.fillText(a.id, p.x + 6, p.y - 5);
  }
}
function mapXY(p) {
  return { x: (p.x / MAP_SIZE + .5) * 320,
    y: (p.z / MAP_SIZE + .5) * 320 };
}
function drawMap() {
  mapCtx.clearRect(0, 0, 320, 320);
  mapCtx.drawImage(mapImage, 0, 0);
  const target = LANDMARKS[Number($("route").value)];
  const tp = mapXY(geo(target.lat, target.lon));
  const own = mapXY(flight);
  mapCtx.strokeStyle = "#b0ebf6"; mapCtx.lineWidth = 1.5;
  mapCtx.setLineDash([5, 5]); mapCtx.beginPath();
  mapCtx.moveTo(own.x, own.y); mapCtx.lineTo(tp.x, tp.y); mapCtx.stroke();
  mapCtx.setLineDash([]);
  mapCtx.fillStyle = "#6febdb"; mapCtx.beginPath();
  mapCtx.arc(tp.x, tp.y, 4, 0, 2 * Math.PI); mapCtx.fill();
  mapCtx.save(); mapCtx.translate(own.x, own.y); mapCtx.rotate(flight.heading);
  mapCtx.fillStyle = "#f6fbff"; mapCtx.strokeStyle = "#07394b";
  mapCtx.lineWidth = 2; mapCtx.beginPath(); mapCtx.moveTo(0, -12);
  mapCtx.lineTo(-7, 9); mapCtx.lineTo(0, 5); mapCtx.lineTo(7, 9);
  mapCtx.closePath(); mapCtx.fill(); mapCtx.stroke(); mapCtx.restore();
}
function updateHud() {
  const gps = toGeo(flight.x, flight.z);
  $("speed").textContent = String(Math.round(flight.speed * 1.943844)).padStart(3, "0");
  $("altitude").textContent = String(Math.max(0, Math.round(flight.y * 3.28084))).padStart(4, "0");
  $("heading").textContent = String(Math.round(deg(flight.heading)) % 360).padStart(3, "0");
  $("throttle").textContent = Math.round(flight.throttle * 100);
  $("throttle-bar").style.width = (flight.throttle * 100) + "%";
  $("vs").textContent = "VS " + (flight.verticalSpeed >= 0 ? "+" : "−") +
    Math.round(Math.abs(flight.verticalSpeed * 196.85)) + " FT/MIN";
  $("gear").textContent = flight.gear ? "GEAR ▾" : "GEAR ▴";
  $("gear").style.color = flight.gear ? "#78e9b9" : "#fbd38d";
  $("flaps").textContent = "FLAPS " + (flight.flaps * 100) + "%";
  $("coords").textContent = Math.abs(gps.lat).toFixed(2) + "°S · " +
    Math.abs(gps.lon).toFixed(2) + "°W";
  const target = LANDMARKS[Number($("route").value)];
  const p = geo(target.lat, target.lon);
  const dx = p.x - flight.x, dz = p.z - flight.z;
  $("distance").textContent = (Math.hypot(dx, dz) / 1852).toFixed(1) + " NM";
  $("bearing").textContent = String(
    (Math.round(deg(Math.atan2(dx, -dz))) + 360) % 360).padStart(3, "0") + "°";
  $("map-bearing").textContent = "N ↑";
  const warn = $("warning");
  warn.textContent = flight.damaged ? "POUSO BRUSCO — REINICIE O VOO" :
    flight.stall ? "STALL — REDUZA O ÂNGULO DE ATAQUE" :
    (flight.y > 8000 ? "ALTITUDE ELEVADA" : "");
  if (flight.onGround && flight.speed > 0 && !flight.damaged) {
    $("flight-status").textContent = "ROLAGEM NO SOLO";
  } else if (!paused && !flight.damaged) {
    $("flight-status").textContent = "EM VOO";
  }
}
function resize() {
  const w = innerWidth, h = innerHeight;
  const quality = $("quality").value;
  const ratio = quality === "eco" ? 1 :
    quality === "high" ? Math.min(devicePixelRatio || 1, 2) :
      Math.min(devicePixelRatio || 1, w < 650 ? 1.1 : 1.55);
  renderer.setPixelRatio(ratio); renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  renderer.shadowMap.enabled = quality === "high";
  world.sun.castShadow = quality === "high";
}
function setupAudio() {
  if (!audio) {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    const context = new Context();
    const engine = context.createOscillator();
    const harmonics = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    engine.type = "sawtooth"; harmonics.type = "triangle";
    filter.type = "lowpass"; filter.frequency.value = 340;
    gain.gain.value = 0;
    engine.connect(filter); harmonics.connect(filter);
    filter.connect(gain); gain.connect(context.destination);
    engine.start(); harmonics.start();
    audio = { context, engine, harmonics, gain, filter };
  }
  audio.context.resume();
}
function updateAudio() {
  if (!audio) return;
  const at = audio.context.currentTime;
  const volume = soundOn && running && !paused ? .012 + flight.throttle * .023 : 0;
  audio.gain.gain.setTargetAtTime(volume, at, .08);
  audio.engine.frequency.setTargetAtTime(55 + flight.throttle * 65 +
    flight.speed * .12, at, .08);
  audio.harmonics.frequency.setTargetAtTime(100 + flight.throttle * 107, at, .09);
  audio.filter.frequency.setTargetAtTime(170 + flight.throttle * 700, at, .1);
}
function setClockText() {
  const minutes = Math.round(hour * 60);
  $("time-value").textContent = String(Math.floor(minutes / 60)).padStart(2, "0") +
    ":" + String(minutes % 60).padStart(2, "0");
}
$("start").addEventListener("click", () => begin());
$("start-runway").addEventListener("click", () => begin(true));
$("takeoff").addEventListener("click", () => begin(true));
$("reset").addEventListener("click", () => begin(false));
$("aircraft").addEventListener("change", () => spawn(false));
$("airport").addEventListener("change", () => spawn(false));
$("camera").addEventListener("click", cycleCamera);
$("pause").addEventListener("click", togglePause);
$("help").addEventListener("click", () => toggleHelp(true));
$("close-help").addEventListener("click", () => toggleHelp(false));
$("resume-help").addEventListener("click", () => toggleHelp(false));
$("fullscreen").addEventListener("click", () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch(() => {});
});
$("sound").addEventListener("click", () => {
  soundOn = !soundOn;
  if (soundOn) setupAudio();
  $("sound").style.color = soundOn ? "#78e9b9" : "";
  $("sound").title = soundOn ? "Silenciar som" : "Ativar som";
  $("sound").setAttribute("aria-label", $("sound").title);
});
$("time").addEventListener("input", event => {
  hour = Number(event.target.value); setClockText();
});
$("quality").addEventListener("change", resize);
$("touch-throttle").addEventListener("input", event => {
  flight.throttle = Number(event.target.value) / 100;
});
$("touch-flaps").addEventListener("click", () => {
  flight.flaps = Math.round((flight.flaps + .5) % 1.5 * 2) / 2;
});
$("touch-gear").addEventListener("click", () => { flight.gear = !flight.gear; });
for (const [id, sign] of [["rudder-left", -1], ["rudder-right", 1]]) {
  const button = $(id);
  button.addEventListener("pointerdown", event => {
    event.preventDefault(); touch.rudder = sign;
    button.setPointerCapture(event.pointerId);
  });
  const release = () => { touch.rudder = 0; };
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
}
const stick = $("stick"), knob = $("stick-knob");
let activePointer = null;
function moveStick(event) {
  if (activePointer !== event.pointerId) return;
  const bounds = stick.getBoundingClientRect();
  const dx = clamp((event.clientX - bounds.left - bounds.width / 2) /
    (bounds.width * .38), -1, 1);
  const dy = clamp((event.clientY - bounds.top - bounds.height / 2) /
    (bounds.height * .38), -1, 1);
  touch.aileron = dx; touch.elevator = dy;
  knob.style.transform = `translate(${dx * 27}px,${dy * 27}px)`;
}
stick.addEventListener("pointerdown", event => {
  activePointer = event.pointerId;
  stick.setPointerCapture(activePointer);
  moveStick(event);
});
stick.addEventListener("pointermove", moveStick);
function releaseStick() {
  activePointer = null;
  touch.aileron = touch.elevator = 0;
  knob.style.transform = "";
}
stick.addEventListener("pointerup", releaseStick);
stick.addEventListener("pointercancel", releaseStick);
stick.addEventListener("lostpointercapture", releaseStick);
function handleKey(event, isDown) {
  const typing = ["INPUT", "SELECT", "TEXTAREA"].includes(event.target?.tagName);
  if (typing) return;
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code))
    event.preventDefault();
  if (isDown) keys.add(event.code);
  else keys.delete(event.code);
  if (!isDown || event.repeat) return;
  if (event.code === "KeyV") cycleCamera();
  if (event.code === "KeyP" && running) togglePause();
  if (event.code === "KeyR") begin(false);
  if (event.code === "KeyH") toggleHelp($("help-overlay").classList.contains("hidden"));
  if (event.code === "Escape" && !$("help-overlay").classList.contains("hidden")) toggleHelp(false);
  if (event.code === "KeyG") flight.gear = !flight.gear;
  if (event.code === "KeyF") flight.flaps = (flight.flaps + .5) % 1.5;
  if (event.code === "KeyM") {
    mapVisible = !mapVisible;
    $("map-panel").classList.toggle("hidden", !mapVisible);
  }
}
window.addEventListener("keydown", e => handleKey(e, true));
window.addEventListener("keyup", e => handleKey(e, false));
window.addEventListener("blur", () => keys.clear());
window.addEventListener("resize", resize);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) keys.clear();
});
setClockText();
buildMap();
spawn(false);
resize();
world.updateEnvironment(hour, $("weather").value, 0);
updateHud();
let last = performance.now();
function animate(now) {
  const dt = Math.min((now - last) / 1000, .10);
  last = now; frame++; frameElapsed += dt; mapTimer += dt;
  if (frameElapsed >= 1) {
    $("fps").textContent = Math.round(frame / frameElapsed) + " FPS";
    frame = 0; frameElapsed = 0;
  }
  if (running && !paused && !$("help-overlay").classList.contains("hidden")) {
    accumulator = 0;
  } else if (running && !paused) {
    accumulator = Math.min(accumulator + dt, .15);
    const input = pilotInput();
    while (accumulator >= FIXED_STEP) {
      stepFlight(flight, input, FIXED_STEP,
        sampleHeight(flight.x, flight.z));
      accumulator -= FIXED_STEP;
    }
  }
  updateAirplane();
  world.updateEnvironment(hour, $("weather").value, dt);
  updateCamera(dt);
  if (mapTimer >= .18) {
    mapTimer = 0;
    updateHud();
    drawMap();
    $("touch-throttle").value = Math.round(flight.throttle * 100);
  }
  updateAudio();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
