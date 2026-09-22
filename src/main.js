import {
  AIRCRAFT, createFlight, stepFlight, clamp, rad, deg
} from "./physics.js";
import {
  AIRPORTS as RIO_AIRPORTS, LANDMARKS as RIO_LANDMARKS,
  geo as rioGeo, toGeo as rioToGeo,
  sampleHeight as rioSampleHeight, createWorld
} from "./world.js";
import {
  AETHERIA_AIRPORTS,AETHERIA_LANDMARKS,AETHERIA_REGIONS,
  AETHERIA_SIZE,aetheriaRegionAt
} from "./aetheria-data.js";
import { createCourse, createChallenge, stepChallenge, RING_COUNT } from "./challenge.js";
import { createCourseVisual } from "./course-renderer.js";
import { readGamepad, chooseGamepad } from "./gamepad.js";
import { createRealTerrain } from "./real-terrain.js";
import { createSky } from "./sky.js";
import { createRigidFlight, stepRigidFlight } from "./six-dof.js";
import { makeDetailedAircraft } from "./aircraft-model.js";
import { createOcean } from "./ocean.js";

const $ = id => document.getElementById(id);
const SAFE_MODE = new URLSearchParams(location.search).has("safe");
const MOBILE_DEVICE = typeof matchMedia === "function" &&
  matchMedia("(pointer: coarse)").matches;
if (SAFE_MODE) {
  $("terrain-mode").value = "art";
  $("flight-model").value = "classic";
  $("quality").value = "eco";
  $("imagery").value = "none";
  $("terrain-status").textContent =
    "Modo compatibilidade: gráficos reduzidos, sem satélite nem shaders avançados.";
}
const loading = $("loading");
const canvas = $("scene");
let THREE;
const sources=[
  // Published by the GitHub Pages workflow. Avoid external CDN outages
  // and let the very same Three.js build be browser-tested before deploy.
  "../vendor/three.module.js",
  "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js",
  "https://unpkg.com/three@0.180.0/build/three.module.js",
  "https://esm.sh/three@0.180.0"
];
const libraryErrors=[];
for(const url of sources){
  try{
    THREE=await import(url);
    break;
  }catch(error){libraryErrors.push(error)}
}
if(!THREE){
  loading.textContent="Biblioteca 3D indisponível. Abra o modo leve.";
  throw new AggregateError(libraryErrors,"Three.js unavailable");
}

let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas, antialias: !SAFE_MODE && !MOBILE_DEVICE, alpha: false,
    powerPreference: SAFE_MODE || MOBILE_DEVICE ? "low-power" : "high-performance"
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
const rioWorld = createWorld(THREE, scene, renderer, SAFE_MODE);
const rioObjects = scene.children.slice();
let world = rioWorld;
let activeWorld = "rio", selectedWorld = "rio", aetheriaModule = null, aetheriaWorld = null;
let AIRPORTS = RIO_AIRPORTS, LANDMARKS = RIO_LANDMARKS;
const geo = (lat,lon) => activeWorld === "aetheria" ?
  {x:lon,z:lat} : rioGeo(lat,lon);
const toGeo = (x,z) => activeWorld === "aetheria" ?
  {lat:z,lon:x} : rioToGeo(x,z);
let worldChangeToken = 0;
let sky = null, ocean = null;
if (!SAFE_MODE) {
  sky = createSky(THREE, scene, world, renderer);
}
// Start with the inexpensive water material; high graphics opts into GPU waves.
world.sea.visible = true;
const nowBrazil = new Intl.DateTimeFormat("en-CA", {
  timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"
});
const brazilParts = Object.fromEntries(nowBrazil.formatToParts(new Date())
  .filter(part => ["year", "month", "day"].includes(part.type))
  .map(part => [part.type, part.value]));
$("flight-date").value = brazilParts.year + "-" +
  brazilParts.month + "-" + brazilParts.day;
let terrainEngine = null, terrainRequested = true, environmentWind = {x:0,y:0,z:0};
let secondsInFlight = 0, lastEnvironment = 0;
function rebuildTerrain() {
  if(activeWorld!=="rio"){
    $("terrain-status").textContent =
      "Aetheria: geração original offline, sem DEM nem satélite.";
    return;
  }
  terrainEngine?.dispose();
  terrainEngine = null;
  world.setRealTerrainEnabled(false);
  terrainRequested = $("terrain-mode").value === "real";
  $("geo-attribution").hidden = !terrainRequested;
  $("credit-eox").hidden = $("imagery").value !== "eox";
  $("credit-maptiler").hidden = $("imagery").value !== "maptiler";
  if (!terrainRequested) {
    $("terrain-status").textContent = "Cenário artístico: nenhum dado real carregado.";
    return;
  }
  const provider = $("imagery").value;
  const apiKey = $("imagery-key").value.trim();
  if (provider === "maptiler" && !apiKey) {
    $("terrain-status").textContent = "Informe uma chave MapTiler autorizada para imagens; usando relevo sem fotografias.";
  }
  let loadSuccess = false;
  terrainEngine = createRealTerrain(THREE, scene, {
    renderer, mobile: MOBILE_DEVICE,
    imagery: provider !== "none" && !(provider === "maptiler" && !apiKey),
    provider, apiKey,
    onStatus(message) { $("terrain-status").textContent = message; },
    onFirstTile() {
      loadSuccess = true;
      $("terrain-status").textContent =
        "Primeiro bloco de elevação disponível; preenchendo a região…";
    },
    onReady() {
      // Never erase the entire fallback world when only one small tile exists.
      if (terrainEngine?.readyCount >= 7) {
        world.setRealTerrainEnabled(true);
        $("terrain-status").textContent =
          "Relevo real ativo · imagens geográficas carregando em segundo plano.";
      }
    }
  });
  if (flight) terrainEngine.update(flight.x, flight.z);
}
function terrainHeight(x,z) {
  if(activeWorld==="aetheria")return world.sampleHeight(x,z);
  const actual = terrainRequested ? terrainEngine?.getHeight(x,z) : null;
  return actual ?? rioSampleHeight(x,z);
}
loading.classList.add("hidden");

let flight, aircraft, activeAircraft = $("aircraft").value;
let running = false, paused = false, helpWasPaused = false;
let cameraMode = 0, hour = Number($("time").value);
let mapVisible = true, audio = null, soundOn = false;
let frame = 0, frameElapsed = 0, accumulator = 0, mapTimer = 0;
let challenge = null, courseVisual = null, ringResults = [];
let gamepadState = { connected: false, actions: [], buttons: [], aileron: 0, elevator: 0, rudder: 0, throttleDelta: 0, brake: false };
let previousGamepadButtons = [], lastGamepadId = "";
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
let MAP_SIZE = 62000, MAP_Z_SIZE = 62000;

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
  model.dispose();
}
function spawn(runway = false) {
  clearChallenge();
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
    options = activeWorld==="aetheria"?
      {x:p.x-650,z:p.z+650,y:airport.elevation+255,
       heading:rad(airport.heading)}:
      {x:p.x-1900,z:p.z+2200,
       y:Math.max(850,airport.elevation+650),
       heading:rad(airport.heading)};
  }
  flight = createFlight(activeAircraft, options);
  if (runway) {
    flight.throttle = .13; flight.pitch = 0; flight.onGround = true;
  }
  if ($("flight-model").value === "rigid") flight = createRigidFlight(flight);
  disposeAirplane(aircraft);
  aircraft = makeDetailedAircraft(THREE, scene, activeAircraft);
  secondsInFlight = 0;
  updateAirplane();
  cameraMode = 0; updateCameraLabel();
  camera.position.copy(planePosition).add(new THREE.Vector3(0, 60, 130));
  accumulator = 0;
  $("touch-throttle").value = Math.round(flight.throttle * 100);
  $("aircraft-class").textContent = a.className.toUpperCase();
}
function updateAirplane() {
  aircraft.group.position.set(flight.x, flight.y, flight.z);
  if (flight.q) {
    aircraft.group.quaternion.set(flight.q.x,flight.q.y,flight.q.z,flight.q.w);
  } else {
    aircraft.group.rotation.order = "YXZ";
    aircraft.group.rotation.set(flight.pitch,-flight.heading,-flight.roll);
  }
  aircraft.animate(FIXED_STEP,flight);
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
function clearChallenge() {
  if (courseVisual) courseVisual.dispose();
  courseVisual = null;
  challenge = null;
  ringResults = [];
  $("challenge-hud").classList.add("hidden");
  $("challenge-feedback").textContent = "";
}
function updateChallengeHud() {
  if (!challenge) return;
  $("score").textContent = challenge.score.toLocaleString("pt-BR");
  $("rings-count").textContent = challenge.next + " / " + challenge.rings.length;
  const remaining = Math.ceil(challenge.timeLeft);
  $("timer").textContent = String(Math.floor(remaining / 60)).padStart(2, "0") +
    ":" + String(remaining % 60).padStart(2, "0");
  $("combo").textContent = "COMBO ×" + Math.max(1, challenge.combo);
  $("boost").textContent = challenge.boostLeft > 0
    ? "IMPULSO +" + challenge.boostLeft.toFixed(1) + "s" : "IMPULSO INATIVO";
  $("boost").classList.toggle("active", challenge.boostLeft > 0);
  $("course-progress").style.width =
    (challenge.next / challenge.rings.length * 100) + "%";
}
function finishChallenge(reason) {
  if (!challenge || $("result-overlay").classList.contains("hidden") === false) return;
  challenge.status = reason;
  challenge.boostLeft = 0;
  paused = true;
  $("pause-name").textContent = "RETOMAR";
  $("flight-status").textContent = "DESAFIO FINALIZADO";
  $("result-title").textContent = reason === "complete"
    ? "PERCURSO CONCLUÍDO" : reason === "timeout" ? "TEMPO ESGOTADO" : "VOO ENCERRADO";
  $("result-detail").textContent = challenge.passed + " argolas corretas · " +
    challenge.missed + " perdidas · " + Math.ceil(challenge.timeLeft) + " s restantes";
  $("result-score").textContent = challenge.score.toLocaleString("pt-BR");
  const key = "rio-flight-best-v1:" + activeWorld + ":" + activeAircraft;
  let record = challenge.score;
  try {
    record = Math.max(Number(localStorage.getItem(key)) || 0, challenge.score);
    localStorage.setItem(key, String(record));
    $("record-label").textContent = "RECORDE DESTA AERONAVE: " +
      record.toLocaleString("pt-BR") + " PONTOS · SALVO NESTE DISPOSITIVO";
  } catch {
    $("record-label").textContent = "Recorde local indisponível neste navegador.";
  }
  $("result-overlay").classList.remove("hidden");
  $("retry-challenge").focus();
}
function begin(runway = false, requestedMode = $("game-mode").value) {
  const mode = runway ? "free" : requestedMode;
  $("game-mode").value = mode;
  $("result-overlay").classList.add("hidden");
  spawn(runway);
  if (mode === "challenge") {
    const rings = createCourse(flight, terrainHeight);
    challenge = createChallenge(rings);
    courseVisual = createCourseVisual(THREE, scene, rings);
    ringResults = [];
    $("challenge-hud").classList.remove("hidden");
    updateChallengeHud();
  }
  running = true; paused = false;
  $("welcome").classList.add("hidden");
  document.body.classList.remove("mobile-menu-open");
  $("mobile-menu").setAttribute("aria-expanded", "false");
  $("pause-name").textContent = "PAUSAR";
  $("flight-status").textContent = mode === "challenge"
    ? "DESAFIO AÉREO" : runway ? "PRONTO PARA DECOLAR" : "EM VOO";
}
function pollController() {
  const enabled = $("gamepad-enabled").checked;
  let pad = null;
  if (enabled && typeof navigator.getGamepads === "function") {
    try { pad = chooseGamepad(navigator.getGamepads()); }
    catch { pad = null; }
  }
  const identity = pad ? pad.index + ":" + pad.id : "";
  if (identity !== lastGamepadId) {
    previousGamepadButtons = [];
    lastGamepadId = identity;
    $("gamepad-status").textContent = pad
      ? "CONECTADO: " + (pad.id || "Gamepad").slice(0, 42)
      : enabled && typeof navigator.getGamepads === "function"
        ? "Nenhum controle detectado · pressione um botão para ativar"
        : enabled ? "Gamepad API indisponível neste navegador"
          : "Controle desativado nas configurações";
  }
  gamepadState = readGamepad(pad, previousGamepadButtons,
    $("invert-gamepad").checked);
  previousGamepadButtons = gamepadState.buttons;
  if (!enabled || !gamepadState.connected) return;
  for (const action of gamepadState.actions) {
    if (action === "start") {
      if (!$("result-overlay").classList.contains("hidden")) begin(false, "challenge");
      else if (!$("welcome").classList.contains("hidden")) begin(false, "free");
      else if (!$("help-overlay").classList.contains("hidden")) toggleHelp(false);
    } else if (action === "pause" && running &&
      $("result-overlay").classList.contains("hidden")) {
      togglePause();
    } else if (action === "help") {
      toggleHelp($("help-overlay").classList.contains("hidden"));
    } else if (running && !paused &&
      $("result-overlay").classList.contains("hidden")) {
      if (action === "gear") flight.gear = !flight.gear;
      if (action === "flaps") flight.flaps = (flight.flaps + .5) % 1.5;
      if (action === "camera") cycleCamera();
    }
  }
}
function fillAirportAndRouteControls() {
  const airport=$("airport"),route=$("route");
  airport.replaceChildren();route.replaceChildren();
  for(const a of AIRPORTS){
    const option=document.createElement("option");
    option.value=a.id;option.textContent=activeWorld==="rio"?
      a.id+" · "+a.name:a.id+" · "+a.regionName+" · "+a.name;
    airport.append(option);
  }
  LANDMARKS.forEach((p,i)=>{
    const option=document.createElement("option");
    option.value=String(i);option.textContent=p.name;
    route.append(option);
  });
  if(activeWorld==="aetheria"){
    const region=$("aetheria-region");
    region.replaceChildren();
    for(const place of AETHERIA_REGIONS){
      const option=document.createElement("option");
      option.value=place.id;option.textContent=place.name+
        " · "+place.biome.toUpperCase();
      region.append(option);
    }
    const a=AIRPORTS.find(item=>item.id==="AE-01")||AIRPORTS[0];
    airport.value=a.id;
    route.value=String(LANDMARKS.findIndex(p=>p.regionId===a.regionId));
    region.value=a.regionId;
  }else{airport.value="SBRJ";route.value="0";}
}
/**
 * Built-in offline Aetheria renderer. It is intentionally inside main.js:
 * even a 404 for /src/aetheria.js cannot block Lite or destroy the Rio world.
 * Full Aetheria still uses the richer optional renderer when available.
 */
function createOfflineAetheriaWorld(THREE,scene,renderer,{mobile=false,
 compatibility=true}={}) {
 const root=new THREE.Group();
 root.name="Aetheria_Offline_Lite";
 scene.add(root);
 const tileSize=2400,radius=1,steps=mobile?16:22;
 const tiles=new Map(),materials=new Set();
 const groundMaterial=new THREE.MeshStandardMaterial({
  color:0xffffff,vertexColors:true,roughness:.95,
  side:THREE.DoubleSide});
 const seaMaterial=new THREE.MeshStandardMaterial({
  color:0x155774,roughness:.52,metalness:.04});
 const sea=new THREE.Mesh(new THREE.PlaneGeometry(35000,35000),seaMaterial);
 sea.rotation.x=-Math.PI/2;sea.position.y=-.8;root.add(sea);
 const cloudMat=new THREE.MeshBasicMaterial({
  color:0xddeaf1,transparent:true,opacity:.72,depthWrite:false});
 const sun=new THREE.DirectionalLight(0xffe9d0,1.8);
 const hemi=new THREE.HemisphereLight(0xc2e9ff,0x476754,.9);
 sun.castShadow=false;scene.add(sun,sun.target,hemi);
 const runwayGlow=new THREE.MeshBasicMaterial({color:0xf1f3d0,
  opacity:0,transparent:true});
 const runwayMaterial=new THREE.MeshStandardMaterial({
  color:0x38424a,roughness:.93});
 const stripeMaterial=new THREE.MeshBasicMaterial({color:0xf0f2e9});
 const activeStructures=new THREE.Group();
 root.add(activeStructures);
 const nearest=(x,z)=>{
  let best=null,d=Infinity;
  for(const airport of AETHERIA_AIRPORTS){
   const dist=Math.hypot(x-airport.x,z-airport.z);
   if(dist<d){best=airport;d=dist}
  }
  return {airport:best,distance:d};
 };
 const baseHeight=(x,z)=>{
  const region=aetheriaRegionAt(x,z);
  const rolling=60*Math.sin(x*.000046+region.seed)*
   Math.cos(z*.000017-region.seed);
  const ridges=90*Math.abs(Math.sin(x*.000097)*
   Math.cos(z*.000052));
  const alpine=["alpine","glacial","fjord"].includes(region.biome);
  const wet=["ocean","tropical"].includes(region.biome);
  let height=region.elevation+rolling+
    (alpine?7:1)*ridges;
  if(wet)height=-15+
    Math.max(0,Math.sin(x*.000024)+Math.cos(z*.000028))**2*65;
  return Math.max(-80,Math.min(4400,height));
 };
 const sampleHeight=(x,z)=>{
  const origin=nearest(x,z);
  if(origin.distance<5200){
   const a=origin.airport,t=Math.max(0,Math.min(1,
    (origin.distance-1600)/3600));
   const blend=t*t*(3-2*t);
   return (a.elevation-1)*(1-blend)+baseHeight(x,z)*blend;
  }
  return baseHeight(x,z);
 };
 function clearGroup(group){
  group.traverse(object=>{
   if(object.isMesh)object.geometry?.dispose?.();
  });
  group.clear();
 }
 function airportVisual(a){
  clearGroup(activeStructures);
  const rw=a.runways[0],angle=-rw.heading*Math.PI/180,
   heading=rw.heading*Math.PI/180;
  const runway=new THREE.Mesh(new THREE.BoxGeometry(
   rw.width,.65,rw.length),runwayMaterial);
  runway.position.set(a.x,a.elevation-.5,a.z);
  runway.rotation.y=angle;activeStructures.add(runway);
  const forward={x:Math.sin(heading),z:-Math.cos(heading)};
  for(let d=-rw.length/2+50;d<rw.length/2-30;d+=110){
   const stripe=new THREE.Mesh(new THREE.BoxGeometry(
    1.8,.05,30),stripeMaterial);
   stripe.position.set(a.x+forward.x*d,a.elevation-.12,
    a.z+forward.z*d);
   stripe.rotation.y=angle;activeStructures.add(stripe);
  }
 }
 function makeTile(ix,iz){
  const N=steps,px=[],color=[],idx=[];
  const originX=ix*tileSize,originZ=iz*tileSize;
  for(let row=0;row<=N;row++)for(let col=0;col<=N;col++){
   const x=originX+col/N*tileSize,z=originZ+row/N*tileSize,
    y=sampleHeight(x,z);
   const region=aetheriaRegionAt(x,z);
   const rgb=new THREE.Color(region.landColor);
   if(y<1)rgb.set(0x337f98);
   else if(y>2200)rgb.lerp(new THREE.Color(0xd2e4e9),
    Math.min(1,(y-2200)/900));
   px.push(col/N*tileSize,y,row/N*tileSize);
   color.push(rgb.r,rgb.g,rgb.b);
   if(row<N&&col<N){
    const i=row*(N+1)+col,j=i+N+1;
    idx.push(i,j,i+1,i+1,j,j+1);
   }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",
    new THREE.Float32BufferAttribute(px,3));
  geometry.setAttribute("color",
    new THREE.Float32BufferAttribute(color,3));
  geometry.setIndex(idx);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,groundMaterial);
  mesh.position.set(originX,0,originZ);root.add(mesh);
  tiles.set(ix+":"+iz,mesh);
 }
 let iterations=0,disposed=false,activeAirport="",region=null;
 function update(x,z){
  if(disposed)return;
  const ix=Math.floor(x/tileSize),iz=Math.floor(z/tileSize);
  const wanted=[];
  for(let a=-radius;a<=radius;a++)for(let b=-radius;b<=radius;b++)
   wanted.push({x:ix+a,z:iz+b,d:a*a+b*b});
  wanted.sort((a,b)=>a.d-b.d);
  const keep=new Set(wanted.map(t=>t.x+":"+t.z));
  for(const [key,mesh] of tiles)if(!keep.has(key)){
   root.remove(mesh);mesh.geometry.dispose();tiles.delete(key);
  }
  // No more than one new mesh every five frames.
  if(tiles.size===0||++iterations%5===0){
   for(const tile of wanted)if(!tiles.has(tile.x+":"+tile.z)){
    makeTile(tile.x,tile.z);break;
   }
  }
  sea.position.x=x;sea.position.z=z;
  region=aetheriaRegionAt(x,z);
  const closest=nearest(x,z);
  if(closest.distance<12000&&closest.airport.id!==activeAirport){
   airportVisual(closest.airport);
   activeAirport=closest.airport.id;
  }else if(closest.distance>=12000&&activeAirport){
   clearGroup(activeStructures);activeAirport="";
  }
 }
 function updateEnvironment(hour,weather,dt){
  const sunHeight=Math.max(.03,Math.sin((hour-5)/14*Math.PI));
  sun.intensity=sunHeight*(weather==="nublado"?1.2:2.2);
  hemi.intensity=.2+sunHeight*.8;
  runwayGlow.opacity=sunHeight<.2?.9:0;
  cloudMat.opacity=weather==="nublado"?.91:.7;
 }
 function dispose(){
  if(disposed)return;
  disposed=true;
  for(const mesh of tiles.values())mesh.geometry.dispose();
  tiles.clear();clearGroup(activeStructures);
  root.removeFromParent();sea.geometry.dispose();
  for(const material of [groundMaterial,seaMaterial,
   cloudMat,runwayGlow,runwayMaterial,stripeMaterial])
   material.dispose();
  scene.remove(sun,sun.target,hemi);
 }
 return {root,sun,hemi,sea,cloudMat,runwayGlow,
  airports:AETHERIA_AIRPORTS,landmarks:AETHERIA_LANDMARKS,
  sampleHeight,update,updateEnvironment,dispose,
  setRealTerrainEnabled(){},
  get tileCount(){return tiles.size},
  get tileLimit(){return 9},
  get region(){return region},
  get status(){return "Aetheria leve · "+
    (region?.name||"megaplaneta")+" · terreno offline"}
 };
}
function syncWorldChoices(value){
  for(const option of document.querySelectorAll(".world-choice")){
    const selected=option.dataset.world===value;
    option.classList.toggle("is-active",selected);
    option.setAttribute("aria-pressed",String(selected));
  }
}
function setCinematic(enabled){
  document.body.classList.toggle("cinematic-mode",enabled);
  $("hud-toggle").setAttribute("aria-pressed",String(enabled));
  $("hud-toggle").title=enabled?"Mostrar HUD (U)":"Ocultar HUD (U)";
  $("hud-toggle").setAttribute("aria-label",
    enabled?"Mostrar HUD e menus":"Ocultar HUD e menus");
}
function toggleCinematic(){setCinematic(
  !document.body.classList.contains("cinematic-mode"))}
$("hud-toggle").addEventListener("click",toggleCinematic);
$("hud-restore").addEventListener("click",()=>setCinematic(false));
document.querySelectorAll(".world-choice").forEach(option=>{
  option.addEventListener("click",()=>{
    if($("world-select").disabled)return;
    changeWorld(option.dataset.world);
  });
});
syncWorldChoices("rio");
async function changeWorld(next) {
  if(!["rio","aetheria","aetheria-lite"].includes(next))return;
  const isAetheria=next!=="rio";
  if(next===selectedWorld){
    $("welcome-world").value=$("world-select").value=next;
    syncWorldChoices(next);
    return;
  }
  const token=++worldChangeToken,wasRunning=running,
    mode=$("game-mode").value;
  $("world-select").disabled=true;
  $("welcome-world").disabled=true;
  $("start").disabled=true;
  $("welcome-challenge").disabled=true;
  $("start-runway").disabled=true;
  for(const card of document.querySelectorAll(".world-choice"))
    card.disabled=true;
  $("world-info").textContent=isAetheria?
    "Preparando quatro regiões e quatro aeroportos detalhados…":
    "Reabrindo o Rio de Janeiro…";
  const priorPause=paused;
  paused=true;accumulator=0;
  let prepared=null;
  try{
    let usedFallback=false;
    if(isAetheria){
      const lite=next==="aetheria-lite"||SAFE_MODE;
      $("quality").value=lite?"eco":"high";
      if(!lite){
        try{
          // A failed or stale delayed module never blocks the fictional world.
          aetheriaModule??=await import("./aetheria.js?v=0.5.1");
        }catch(importError){
          usedFallback=true;
          $("quality").value="eco";
          console.warn("[Flight Simulator] High quality unavailable; using offline Lite",
            importError);
        }
      }
      if(token!==worldChangeToken)return;
      prepared=lite||usedFallback?
        createOfflineAetheriaWorld(THREE,scene,renderer,
          {mobile:MOBILE_DEVICE,compatibility:true}):
        aetheriaModule.createAetheriaWorld(THREE,scene,renderer,
          {mobile:MOBILE_DEVICE,compatibility:false});
    }
    if(token!==worldChangeToken){
      prepared?.dispose();return;
    }
    terrainEngine?.dispose();terrainEngine=null;
    rioWorld.setRealTerrainEnabled(false);
    sky?.dispose();sky=null;
    if(next==="rio"){
      aetheriaWorld?.dispose();
      aetheriaWorld=null;
      world=rioWorld;AIRPORTS=RIO_AIRPORTS;
      LANDMARKS=RIO_LANDMARKS;
      MAP_SIZE=MAP_Z_SIZE=62000;
      for(const item of rioObjects)item.visible=true;
      scene.background=new THREE.Color(0xb2dbf0);
      $("map-world-label").textContent="· RIO DE JANEIRO";
      $("world-info").textContent=
        "Rio de Janeiro · 3 aeroportos · relevo real opcional";
      $("terrain-status").textContent=
        "Rio restaurado · selecione o relevo na configuração.";
      terrainRequested=$("terrain-mode").value==="real";
    }else{
      aetheriaWorld?.dispose();
      activeWorld="aetheria";
      aetheriaWorld=prepared;world=prepared;
      AIRPORTS=AETHERIA_AIRPORTS;
      LANDMARKS=AETHERIA_LANDMARKS;
      MAP_SIZE=AETHERIA_SIZE.width;
      MAP_Z_SIZE=AETHERIA_SIZE.height;
      for(const item of rioObjects)item.visible=false;
      terrainRequested=false;
      scene.background=new THREE.Color(0x94c4d7);
      $("map-world-label").textContent="· AETHERIA";
      $("world-info").textContent=
        "Aetheria · 4 regiões · 4 aeroportos · "+
        (usedFallback?"modo leve de recuperação":
        next==="aetheria-lite"||SAFE_MODE?"modo leve":"qualidade máxima");
    }
    activeWorld=isAetheria?"aetheria":"rio";
    selectedWorld=next;
    $("world-select").value=$("welcome-world").value=next;
    syncWorldChoices(next);
    $("rio-terrain-options").hidden=next!=="rio";
    $("aetheria-controls").hidden=!isAetheria;
    $("geo-attribution").hidden=next!=="rio";
    $("welcome-title").textContent="FLIGHT SIMULATOR";
    $("welcome-desc").textContent=next==="rio"?
      "Decole sobre a Baía de Guanabara, contorne o Pão de Açúcar e descubra o Rio de Janeiro em um simulador 3D feito para o navegador.":
      "Um cenário compacto de 48 × 36 km: uma capital costeira, ilhas tropicais, montanhas e selva. Quatro aeroportos para explorar com detalhes — não dezenas de pistas vazias.";
    $("welcome-features").innerHTML=next==="rio"?
      "<span>◈ 3 AERONAVES</span><span>◈ 3 AEROPORTOS</span><span>◈ VOO LIVRE + DESAFIO</span>":
      "<span>◈ 48 × 36 KM</span><span>◈ 4 AEROPORTOS</span><span>◈ VOO LIVRE + DESAFIO</span>";
    if(!SAFE_MODE){
      try{
        sky=createSky(THREE,scene,world,renderer,
          next==="rio"?{lat:-22.93,lon:-43.21}:{lat:0,lon:0});
      }catch(skyError){
        sky=null;
        console.warn("[Flight Simulator] Optional sky disabled",skyError);
      }
    }
    fillAirportAndRouteControls();
    buildMap();
    if(wasRunning)begin(false,mode);
    else spawn(false);
    world.update?.(flight.x,flight.z,0);
    resize();
    updateHud();drawMap();
    if(next==="rio"&&terrainRequested&&!SAFE_MODE)
      setTimeout(()=>{if(activeWorld==="rio")rebuildTerrain()},900);
  }catch(error){
    prepared?.dispose();
    console.error("[Aetheria] World switch failed",error);
    $("world-info").textContent=
      "Falha ao alternar mundo: "+(error?.message||"erro desconhecido");
    // The existing Rio world remains a fallback on first load failure.
    if(activeWorld==="rio"){
      selectedWorld="rio";
      $("world-select").value=$("welcome-world").value="rio";
      syncWorldChoices("rio");
    }
    paused=priorPause;
  }finally{
    if(token===worldChangeToken){
      $("world-select").disabled=false;
      $("welcome-world").disabled=false;
      $("start").disabled=false;
      $("welcome-challenge").disabled=false;
      $("start-runway").disabled=false;
      for(const card of document.querySelectorAll(".world-choice"))
        card.disabled=false;
    }
  }
}
$("world-select").addEventListener("change",event=>
  changeWorld(event.target.value));
$("welcome-world").addEventListener("change",event=>
  changeWorld(event.target.value));
$("aetheria-region").addEventListener("change",event=>{
  if(activeWorld!=="aetheria")return;
  const airport=AIRPORTS.find(a=>a.regionId===event.target.value);
  const idx=LANDMARKS.findIndex(p=>p.regionId===event.target.value);
  if(!airport)return;
  $("airport").value=airport.id;
  if(idx>=0)$("route").value=String(idx);
  if(running)begin(false,$("game-mode").value);
  else spawn(false);
  world.update?.(flight.x,flight.z,0);
});
$("gamepad-enabled").addEventListener("change", () => { lastGamepadId = "_refresh"; });
window.addEventListener("gamepadconnected", () => { lastGamepadId = "_refresh"; });
window.addEventListener("gamepaddisconnected", () => { lastGamepadId = "_refresh"; });
function pilotInput() {
  const press = (...codes) => codes.some(code => keys.has(code));
  return {
    elevator: clamp((press("KeyW", "ArrowUp") ? 1 : 0) -
      (press("KeyS", "ArrowDown") ? 1 : 0) + touch.elevator + gamepadState.elevator, -1, 1),
    aileron: clamp((press("KeyD", "ArrowRight") ? 1 : 0) -
      (press("KeyA", "ArrowLeft") ? 1 : 0) + touch.aileron + gamepadState.aileron, -1, 1),
    rudder: clamp((press("KeyE") ? 1 : 0) -
      (press("KeyQ") ? 1 : 0) + touch.rudder + gamepadState.rudder, -1, 1),
    throttleDelta: (press("Equal", "NumpadAdd") ? .37 : 0) -
      (press("Minus", "NumpadSubtract") ? .37 : 0) + gamepadState.throttleDelta,
    brake: press("KeyB", "Space") || gamepadState.brake,
    boostAcceleration: challenge?.status === "running" && challenge.boostLeft > 0 ? 12 : 0,
    windX: environmentWind.x,
    windY: environmentWind.y,
    windZ: environmentWind.z
  };
}
function buildMap() {
  mapBackground.clearRect(0,0,320,320);
  const step = activeWorld === "aetheria" ? 8 : 4;
  if(activeWorld === "aetheria") {
    mapBackground.fillStyle = "#113b52";
    mapBackground.fillRect(0,0,320,320);
    // Biomes are a visual navigation atlas, NOT invented geographic photos.
    for(const region of AETHERIA_REGIONS){
      const p=mapXY(region);
      const color=new THREE.Color(region.landColor);
      mapBackground.fillStyle=color.getStyle();
      mapBackground.globalAlpha=.82;
      mapBackground.fillRect(p.x-32,p.y-40,64,80);
      mapBackground.globalAlpha=1;
      mapBackground.strokeStyle="#d1e8ec66";
      mapBackground.strokeRect(p.x-32,p.y-40,64,80);
      mapBackground.font="bold 9px sans-serif";
      mapBackground.textAlign="center";
      mapBackground.fillStyle="#e9f6f7";
      mapBackground.fillText(region.name.toUpperCase(),p.x,p.y+2,62);
    }
    for(const a of AIRPORTS){
      const p=mapXY(a);
      mapBackground.fillStyle=a.category==="internacional"?
        "#ffe89c":"#d1ebef";
      mapBackground.fillRect(p.x-1.3,p.y-1.3,2.6,2.6);
    }
    mapBackground.textAlign="left";
    return;
  }
  for (let y=0;y<320;y+=step)for(let x=0;x<320;x+=step){
    const wx=(x/320-.5)*MAP_SIZE,wz=(y/320-.5)*MAP_Z_SIZE;
    const h=rioSampleHeight(wx,wz);
    mapBackground.fillStyle=h<0?"#155066":
      h>350?"#385f49":h>80?"#527f56":"#71887a";
    mapBackground.fillRect(x,y,step,step);
  }
  mapBackground.strokeStyle="#f0ce9c";
  mapBackground.lineWidth=1;
  for(const a of AIRPORTS){
    const p=mapXY(geo(a.lat,a.lon));
    mapBackground.beginPath();mapBackground.arc(p.x,p.y,4,0,Math.PI*2);
    mapBackground.fillStyle="#ffda92";mapBackground.fill();
    mapBackground.fillStyle="#fff1c7";
    mapBackground.font="bold 11px sans-serif";
    mapBackground.fillText(a.id,p.x+6,p.y-5);
  }
}
function mapXY(p) {
  return { x: (p.x / MAP_SIZE + .5) * 320,
    y: (p.z / MAP_Z_SIZE + .5) * 320 };
}
function drawMap() {
  mapCtx.clearRect(0, 0, 320, 320);
  mapCtx.drawImage(mapImage, 0, 0);
  const target = LANDMARKS[Number($("route").value)] || LANDMARKS[0];
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
  $("speed").textContent = String(Math.round((flight.ias ?? flight.speed) * 1.943844)).padStart(3, "0");
  $("altitude").textContent = String(Math.max(0, Math.round(flight.y * 3.28084))).padStart(4, "0");
  $("heading").textContent = String(Math.round(deg(flight.heading)) % 360).padStart(3, "0");
  $("throttle").textContent = Math.round(flight.throttle * 100);
  $("throttle-bar").style.width = (flight.throttle * 100) + "%";
  $("vs").textContent = "VS " + (flight.verticalSpeed >= 0 ? "+" : "−") +
    Math.round(Math.abs(flight.verticalSpeed * 196.85)) + " FT/MIN";
  $("gear").textContent = flight.gear ? "GEAR ▾" : "GEAR ▴";
  $("gear").style.color = flight.gear ? "#78e9b9" : "#fbd38d";
  $("flaps").textContent = "FLAPS " + (flight.flaps * 100) + "%";
  $("coords").textContent = activeWorld==="aetheria" ?
    "X "+(flight.x/1000).toFixed(0)+" KM · Z "+(flight.z/1000).toFixed(0)+" KM" :
    Math.abs(gps.lat).toFixed(2) + "°S · " +
    Math.abs(gps.lon).toFixed(2) + "°W";
  const target = LANDMARKS[Number($("route").value)] || LANDMARKS[0];
  const p = geo(target.lat, target.lon);
  const dx = p.x - flight.x, dz = p.z - flight.z;
  $("distance").textContent = (Math.hypot(dx, dz) / 1852).toFixed(1) + " NM";
  $("bearing").textContent = String(
    (Math.round(deg(Math.atan2(dx, -dz))) + 360) % 360).padStart(3, "0") + "°";
  $("map-bearing").textContent = "N ↑";
  updateChallengeHud();
  const warn = $("warning");
  warn.textContent = flight.damaged ? "POUSO BRUSCO — REINICIE O VOO" :
    flight.stall ? "STALL — REDUZA O ÂNGULO DE ATAQUE" :
    (flight.y > 8000 ? "ALTITUDE ELEVADA" : "");
  if (flight.onGround && flight.speed > 0 && !flight.damaged) {
    $("flight-status").textContent = "ROLAGEM NO SOLO";
  } else if (!paused && !flight.damaged) {
    $("flight-status").textContent = challenge ? "DESAFIO AÉREO" : "EM VOO";
  }
}
function resize() {
  const w = innerWidth, h = innerHeight;
  const quality = $("quality").value;
  const ratio = quality === "eco" ? Math.min(devicePixelRatio || 1, .9) :
    quality === "high" ? Math.min(devicePixelRatio || 1, 1.75) :
      Math.min(devicePixelRatio || 1, w < 650 ? 1 : 1.15);
  renderer.setPixelRatio(ratio); renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  renderer.shadowMap.enabled = quality === "high";
  world.sun.castShadow = quality === "high";
  const useOcean = !SAFE_MODE && !MOBILE_DEVICE && quality === "high";
  if (useOcean && !ocean) ocean = createOcean(THREE, scene, renderer);
  if (ocean) ocean.surface.visible = useOcean;
  world.sea.visible = !useOcean;
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
$("start").addEventListener("click", () => begin(false, "free"));
$("welcome-challenge").addEventListener("click", () => begin(false, "challenge"));
$("start-challenge").addEventListener("click", () => begin(false, "challenge"));
$("start-runway").addEventListener("click", () => begin(true, "free"));
$("takeoff").addEventListener("click", () => begin(true, "free"));
$("reset").addEventListener("click", () => begin(false));
$("retry-challenge").addEventListener("click", () => begin(false, "challenge"));
$("result-free").addEventListener("click", () => begin(false, "free"));
$("game-mode").addEventListener("change", () => {
  if ($("game-mode").value === "challenge") begin(false, "challenge");
  else {
    clearChallenge();
    $("result-overlay").classList.add("hidden");
    if (running) { paused = false; $("pause-name").textContent = "PAUSAR"; }
  }
});
$("aircraft").addEventListener("change", () => {
  if(running)begin(false,$("game-mode").value);
  else spawn(false);
});
$("airport").addEventListener("change", () => {
  if(activeWorld==="aetheria"){
    const airport=AIRPORTS.find(a=>a.id===$("airport").value);
    if(airport){
      $("aetheria-region").value=airport.regionId;
      const idx=LANDMARKS.findIndex(p=>p.regionId===airport.regionId);
      if(idx>=0)$("route").value=String(idx);
    }
  }
  if(running)begin(false,$("game-mode").value);
  else spawn(false);
});
$("camera").addEventListener("click", cycleCamera);
$("mobile-camera").addEventListener("click", cycleCamera);
$("mobile-pause").addEventListener("click", () => { if (running) togglePause(); });
$("mobile-menu").addEventListener("click", () => {
  const opened = document.body.classList.toggle("mobile-menu-open");
  $("mobile-menu").setAttribute("aria-expanded", String(opened));
});
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
$("apply-terrain").addEventListener("click", rebuildTerrain);
$("terrain-mode").addEventListener("change", rebuildTerrain);
$("flight-model").addEventListener("change", () => {
  if (flight) spawn(false);
});
$("imagery").addEventListener("change", () => {
  $("imagery-key").hidden = $("imagery").value !== "maptiler";
});
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
  if(event.code==="KeyU")toggleCinematic();
  if(event.code==="Escape" &&
    document.body.classList.contains("cinematic-mode"))
      setCinematic(false);
  if (event.code === "KeyV") cycleCamera();
  if (event.code === "KeyC") begin(false, challenge ? "free" : "challenge");
  if (event.code === "KeyP" && running) togglePause();
  if (event.code === "KeyR") begin(false, challenge ? "challenge" : "free");
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
  if (document.hidden) {
    keys.clear();
    if (running && challenge?.status === "running" && !paused) togglePause();
  }
});
setClockText();
buildMap();
spawn(false);
resize();
// Schedule network data only after the first interactive frame.
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
  pollController();
  if (running && !paused && !$("help-overlay").classList.contains("hidden")) {
    accumulator = 0;
  } else if (running && !paused) {
    accumulator = Math.min(accumulator + dt, .15);
    const input = pilotInput();
    while (accumulator >= FIXED_STEP) {
      const previous = { x: flight.x, y: flight.y, z: flight.z };
      const height = Math.max(0, terrainHeight(flight.x, flight.z));
      if (flight.q) stepRigidFlight(flight,input,FIXED_STEP,height);
      else stepFlight(flight,input,FIXED_STEP,height);
      secondsInFlight += FIXED_STEP;
      accumulator -= FIXED_STEP;
      if (challenge?.status === "running") {
        const events = stepChallenge(challenge, previous, flight, FIXED_STEP);
        for (const event of events) {
          if (event.type === "hit" || event.type === "miss") {
            ringResults.push(event.type === "hit");
            courseVisual.setProgress(challenge.next, ringResults);
            $("challenge-feedback").textContent = event.type === "hit"
              ? "+" + event.gained + " PTS · COMBO ×" + event.combo
              : "ARGOLA PERDIDA · COMBO REINICIADO";
            updateChallengeHud();
          }
          if (["complete", "timeout"].includes(event.type)) finishChallenge(event.type);
        }
        if (flight.damaged && challenge.status === "running") {
          finishChallenge("crash");
        }
      }
      if (paused) { accumulator = 0; break; }
    }
  }
  updateAirplane();
  world.updateEnvironment(hour, $("weather").value, dt);
  if(activeWorld==="aetheria")world.update(flight.x,flight.z,dt);
  const hourText = $("time-value").textContent;
  const localDate = new Date(
    ($("flight-date").value || "2026-09-22") +
    "T" + hourText + ":00-03:00");
  if (sky) {
    const environment = sky.update(localDate, $("weather").value, dt, flight);
    environmentWind = environment.wind || environmentWind;
    if(activeWorld==="aetheria" && aetheriaModule?.aetheriaWeatherAt) {
      const climate=aetheriaModule.aetheriaWeatherAt(
        flight.x,flight.z,secondsInFlight,$("weather").value);
      environmentWind=climate.wind;
    }
    ocean?.update(dt, environment.sun.vector, $("weather").value);
    if(ocean&&activeWorld==="aetheria"){
      ocean.surface.position.x=flight.x;
      ocean.surface.position.z=flight.z;
    }
  }
  if(activeWorld==="rio")terrainEngine?.update(flight.x, flight.z);
  updateCamera(dt);
  if (mapTimer >= .18) {
    mapTimer = 0;
    updateHud();
    drawMap();
    if(activeWorld==="aetheria")
      $("world-info").textContent=world.status+
        " · "+AETHERIA_AIRPORTS.length+" aeroportos · "+world.tileCount+"/"+world.tileLimit+" blocos";
    $("touch-throttle").value = Math.round(flight.throttle * 100);
  }
  updateAudio();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
const requestedWorld=new URLSearchParams(location.search).get("world");
if(requestedWorld==="aetheria"||requestedWorld==="aetheria-lite"){
  setTimeout(()=>changeWorld(
    SAFE_MODE?"aetheria-lite":requestedWorld),200);
}else if(!SAFE_MODE && $("terrain-mode").value==="real"){
  // Rio keeps the old DEM optional and starts after the first render.
  setTimeout(()=>{if(activeWorld==="rio")rebuildTerrain()},1200);
}else{
  $("terrain-status").textContent="Modo leve ativo · cenário disponível.";
}
