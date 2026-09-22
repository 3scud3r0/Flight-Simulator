import { rad, clamp } from "./physics.js";

export const ORIGIN = Object.freeze({ lat: -22.930, lon: -43.210 });
export const AIRPORTS = Object.freeze([
  { id: "SBRJ", name: "Santos Dumont", lat: -22.9104, lon: -43.1628, heading: 357, elevation: 4,
    runways: [{ name: "02R / 20L", length: 1323, width: 42, offset: 68, heading: 357 },
      { name: "02L / 20R", length: 1260, width: 30, offset: -69, heading: 357 }] },
  { id: "SBGL", name: "Galeão", lat: -22.810, lon: -43.250, heading: 100, elevation: 9,
    runways: [{ name: "10 / 28", length: 4000, width: 45, offset: 330, heading: 100 },
      { name: "15 / 33", length: 3180, width: 45, offset: -450, heading: 150 }] },
  { id: "SBJR", name: "Jacarepaguá", lat: -22.986, lon: -43.372, heading: 30, elevation: 8,
    runways: [{ name: "03 / 21", length: 900, width: 30, offset: 0, heading: 30 }] }
]);
export const LANDMARKS = Object.freeze([
  { name: "Pão de Açúcar", lat: -22.9487, lon: -43.1565, height: 396 },
  { name: "Cristo Redentor", lat: -22.9519, lon: -43.2105, height: 710 },
  { name: "Maracanã", lat: -22.9120, lon: -43.2302, height: 12 },
  { name: "Lagoa Rodrigo de Freitas", lat: -22.9740, lon: -43.2110, height: 0 },
  { name: "Praia de Copacabana", lat: -22.9724, lon: -43.1822, height: 2 }
]);
const METRES_LAT = 111320;
const METRES_LON = METRES_LAT * Math.cos(rad(ORIGIN.lat));
export function geo(lat, lon) {
  return { x: (lon - ORIGIN.lon) * METRES_LON,
    z: -(lat - ORIGIN.lat) * METRES_LAT };
}
export function toGeo(x, z) {
  return { lat: ORIGIN.lat - z / METRES_LAT,
    lon: ORIGIN.lon + x / METRES_LON };
}
export function shorelineLatitude(lon) {
  const pts = [
    [-43.57, -23.065], [-43.48, -23.043], [-43.39, -23.014],
    [-43.32, -23.004], [-43.27, -22.996], [-43.235, -22.989],
    [-43.212, -22.991], [-43.192, -22.983], [-43.180, -22.971],
    [-43.166, -22.953], [-43.149, -22.952], [-43.09, -22.965]
  ];
  for (let i = 1; i < pts.length; i++) {
    if (lon < pts[i][0]) {
      const t = clamp((lon - pts[i - 1][0]) /
        (pts[i][0] - pts[i - 1][0]), 0, 1);
      return pts[i - 1][1] * (1 - t) + pts[i][1] * t;
    }
  }
  return pts[pts.length - 1][1];
}
export function isLand(x, z) {
  const { lat, lon } = toGeo(x, z);
  if (lat < shorelineLatitude(lon)) return false;
  // Approximate Guanabara Bay; NOT a surveyed coastline.
  const west = lat < -22.91 ? -43.17 : lat < -22.85 ? -43.17 :
    lat < -22.81 ? -43.195 : -43.228;
  const bay = lat > -22.985 && lat < -22.75 && lon > west && lon < -43.075;
  const lagoon = Math.pow((lat + 22.974) / 0.008, 2) +
    Math.pow((lon + 43.211) / 0.014, 2) < 1;
  return !bay && !lagoon;
}
const HILLS = [
  [-22.9519, -43.2105, 710, 780, 680],
  [-22.9487, -43.1565, 396, 430, 480],
  [-22.955, -43.232, 550, 1800, 1150],
  [-22.966, -43.265, 630, 2100, 1250],
  [-22.975, -43.286, 450, 1800, 1400],
  [-22.924, -43.297, 920, 2600, 2200],
  [-22.968, -43.364, 450, 2500, 1800],
  [-22.886, -43.296, 410, 2800, 1900],
  [-22.947, -43.135, 275, 560, 450],
  [-22.91, -43.07, 400, 1700, 1800]
].map(([lat, lon, h, sx, sz]) => ({ ...geo(lat, lon), h, sx, sz }));
export function sampleHeight(x, z) {
  const { lat, lon } = toGeo(x, z);
  const airport = AIRPORTS.find(a => {
    const p = geo(a.lat, a.lon);
    return Math.hypot(x - p.x, z - p.z) < (a.id === "SBGL" ? 2500 : a.id === "SBRJ" ? 950 : 650);
  });
  if (airport) return airport.elevation - 0.9;
  if (!isLand(x, z)) return -7;
  let h = 3.5 + 2 * Math.sin(x / 800) * Math.cos(z / 530);
  for (const peak of HILLS) {
    const dx = (x - peak.x) / peak.sx;
    const dz = (z - peak.z) / peak.sz;
    h += peak.h * Math.exp(-2.35 * (dx * dx + dz * dz));
  }
  if (Math.abs(lat - shorelineLatitude(lon)) < 0.0012) h = Math.min(h, 3.5);
  return h;
}
function rng(seed = 1597) {
  let n = seed >>> 0;
  return () => ((n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296);
}
function proceduralTexture(THREE, kind, size = 2048) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const cx = c.getContext("2d");
  const base = {
    grass: [67, 106, 62], asphalt: [45, 51, 59],
    sand: [199, 178, 129], concrete: [141, 150, 151],
    water: [21, 111, 145]
  }[kind];
  cx.fillStyle = `rgb(${base.join(",")})`;
  cx.fillRect(0, 0, size, size);
  const rand = rng(size + kind.length * 37);
  for (let i = 0; i < size * 18; i++) {
    const shift = (rand() - 0.5) * (kind === "asphalt" ? 34 : 58);
    cx.fillStyle = `rgba(${shift > 0 ? 255 : 0},${shift > 0 ? 255 : 0},${shift > 0 ? 255 : 0},${Math.abs(shift) / 220})`;
    const x = rand() * size, y = rand() * size;
    cx.fillRect(x, y, 1 + rand() * 8, 1 + rand() * 8);
  }
  if (kind === "water") {
    for (let i = 0; i < 1300; i++) {
      cx.strokeStyle = `rgba(190,235,247,${rand() * 0.13})`;
      cx.beginPath(); const x = rand() * size, y = rand() * size;
      cx.moveTo(x, y); cx.lineTo(x + rand() * 75, y + rand() * 3);
      cx.stroke();
    }
  }
  if (kind === "asphalt" || kind === "concrete") {
    cx.lineWidth = 2; cx.strokeStyle = "rgba(10,13,19,.15)";
    for (let x = 0; x < size; x += 128) {
      cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, size); cx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(c);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
function label(THREE, text, color = "#e9f5ff") {
  const c = document.createElement("canvas"); c.width = 512; c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(4,14,29,.75)"; g.fillRect(2, 3, 508, 120);
  g.strokeStyle = "#71d8ef"; g.lineWidth = 3; g.strokeRect(2, 3, 508, 120);
  g.fillStyle = color; g.font = "bold 37px system-ui"; g.textAlign = "center";
  g.fillText(text, 256, 79, 488);
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true }));
  s.scale.set(380, 95, 1); return s;
}
export function createWorld(THREE, scene, renderer) {
  const rand = rng();
  // 2K on desktop; 1K on coarse-pointer mobile hardware to limit GPU memory.
  const mobile = typeof matchMedia === "function" &&
    matchMedia("(pointer: coarse)").matches;
  const textureSize = Math.min(renderer.capabilities.maxTextureSize,
    mobile ? 1024 : 2048);
  const grass = proceduralTexture(THREE, "grass", textureSize);
  const asphalt = proceduralTexture(THREE, "asphalt", textureSize);
  const sand = proceduralTexture(THREE, "sand", textureSize);
  const water = proceduralTexture(THREE, "water", Math.min(textureSize, 1024));
  water.repeat.set(34, 34);
  grass.repeat.set(42, 42);
  asphalt.repeat.set(2, 6);
  const groundMat = new THREE.MeshStandardMaterial({
    map: grass, vertexColors: true, roughness: 0.97, flatShading: false
  });
  const segments = 300, span = 63000;
  const vertices = [], colors = [], uvs = [], indices = [];
  const color = new THREE.Color();
  for (let row = 0; row <= segments; row++) {
    for (let col = 0; col <= segments; col++) {
      const x = (col / segments - 0.5) * span;
      const z = (row / segments - 0.5) * span;
      const h = sampleHeight(x, z);
      const land = h > 0;
      vertices.push(x, h, z);
      uvs.push(col / segments, row / segments);
      if (!land) color.setRGB(0.05, 0.20, 0.25);
      else if (h > 115) color.setRGB(0.32, 0.47, 0.30);
      else if (h > 35) color.setRGB(0.52, 0.65, 0.44);
      else {
        const gp = toGeo(x, z);
        const beach = Math.abs(gp.lat - shorelineLatitude(gp.lon)) < 0.002;
        color.setRGB(beach ? 1.22 : 0.80, beach ? 1.09 : 0.86, beach ? 0.79 : 0.76);
      }
      colors.push(color.r, color.g, color.b);
      if (row < segments && col < segments) {
        const i = row * (segments + 1) + col;
        indices.push(i, i + segments + 1, i + 1, i + 1, i + segments + 1, i + segments + 2);
      }
    }
  }
  const terrainGeo = new THREE.BufferGeometry();
  terrainGeo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  terrainGeo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  terrainGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  terrainGeo.setIndex(indices); terrainGeo.computeVertexNormals();
  const terrain = new THREE.Mesh(terrainGeo, groundMat);
  terrain.receiveShadow = true; scene.add(terrain);

  const sea = new THREE.Mesh(new THREE.PlaneGeometry(span, span),
    new THREE.MeshStandardMaterial({
      map: water, color: 0x75bcd0, metalness: .28, roughness: .26,
      transparent: true, opacity: .92
    }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = 0;
  sea.receiveShadow = true; scene.add(sea);

  const runwayMat = new THREE.MeshStandardMaterial({ map: asphalt, roughness: .94 });
  const apronMat = new THREE.MeshStandardMaterial({
    map: proceduralTexture(THREE, "concrete"), roughness: .98
  });
  const lineWhite = new THREE.MeshBasicMaterial({ color: 0xf0eee1 });
  const lineYellow = new THREE.MeshBasicMaterial({ color: 0xf6b934 });
  function pad(x, z, width, length, y, material, heading = 0) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, length), material);
    mesh.rotation.set(-Math.PI / 2, 0, -heading);
    mesh.position.set(x, y, z); mesh.receiveShadow = true;
    scene.add(mesh); return mesh;
  }
  for (const airport of AIRPORTS) {
    const p = geo(airport.lat, airport.lon), y = airport.elevation;
    pad(p.x, p.z, airport.id === "SBGL" ? 4700 : airport.id === "SBRJ" ? 610 : 490,
      airport.id === "SBGL" ? 4300 : airport.id === "SBRJ" ? 1750 : 1150,
      y, apronMat, rad(airport.heading));
    for (const rw of airport.runways) {
      const theta = rad(rw.heading);
      const perpendicular = { x: Math.cos(theta), z: Math.sin(theta) };
      const rx = p.x + perpendicular.x * rw.offset;
      const rz = p.z + perpendicular.z * rw.offset;
      pad(rx, rz, rw.width, rw.length, y + .16, runwayMat, theta);
      for (let i = -4; i <= 4; i++) {
        const along = i * rw.length / 11;
        const dash = pad(rx + Math.sin(theta) * along,
          rz - Math.cos(theta) * along, 1.5, 35, y + .20, lineWhite, theta);
        dash.renderOrder = 2;
      }
      for (const end of [-1, 1]) {
        for (let i = -2; i <= 2; i++) {
          const along = end * (rw.length / 2 - 40);
          pad(rx + Math.sin(theta) * along + perpendicular.x * i * 5.8,
            rz - Math.cos(theta) * along + perpendicular.z * i * 5.8,
            2.6, 23, y + .21, lineWhite, theta);
        }
      }
    }
    const marker = label(THREE, `${airport.id} · ${airport.name}`);
    marker.position.set(p.x, y + 230, p.z); scene.add(marker);
    for (let k = 0; k < 5; k++) {
      const tx = p.x + (k - 2) * 65, tz = p.z + 120;
      pad(tx, tz, 2, 90, y + .19, lineYellow, rad(airport.heading));
    }
  }

  // Approximate sand along the southern coastline, generated as a textured ribbon.
  const beachPositions = [], beachUVs = [], beachIndices = [];
  const beachCount = 240;
  for (let i = 0; i <= beachCount; i++) {
    const lon = -43.46 + i / beachCount * .30;
    const lat = shorelineLatitude(lon);
    for (const offsetLat of [.00009, .00107]) {
      const point = geo(lat + offsetLat, lon);
      beachPositions.push(point.x,
        Math.max(3.5, sampleHeight(point.x, point.z)) + .34, point.z);
      beachUVs.push(i / 6, offsetLat / .00107);
    }
    if (i < beachCount) {
      const n = i * 2;
      beachIndices.push(n, n + 1, n + 2, n + 2, n + 1, n + 3);
    }
  }
  const beachGeo = new THREE.BufferGeometry();
  beachGeo.setAttribute("position", new THREE.Float32BufferAttribute(beachPositions, 3));
  beachGeo.setAttribute("uv", new THREE.Float32BufferAttribute(beachUVs, 2));
  beachGeo.setIndex(beachIndices); beachGeo.computeVertexNormals();
  const beachMesh = new THREE.Mesh(beachGeo,
    new THREE.MeshStandardMaterial({ map: sand, side: THREE.DoubleSide, roughness: 1 }));
  beachMesh.receiveShadow = true; scene.add(beachMesh);

  // Instancing keeps large neighbourhoods to a handful of draw calls.
  const districts = [
    [-22.970, -43.180, 3100, 2100, 380],
    [-22.980, -43.220, 3200, 1900, 280],
    [-22.916, -43.190, 3400, 3100, 460],
    [-22.905, -43.255, 3500, 3200, 300],
    [-22.983, -43.350, 3600, 2400, 420],
    [-22.865, -43.290, 5300, 4200, 470],
    [-22.899, -43.105, 3400, 2800, 270]
  ];
  const boxes = [[], [], [], [], []];
  for (const [lat, lon, sx, sz, count] of districts) {
    const origin = geo(lat, lon);
    for (let i = 0; i < count; i++) {
      const x = origin.x + (rand() - .5) * sx * 2;
      const z = origin.z + (rand() - .5) * sz * 2;
      const y = sampleHeight(x, z);
      if (y < 0 || y > 90) continue;
      const width = 15 + rand() * 32, depth = 15 + rand() * 35;
      const height = 14 + Math.pow(rand(), 1.4) * (lat < -22.95 ? 125 : 85);
      boxes[Math.floor(rand() * boxes.length)].push({ x, y, z, width, depth, height });
    }
  }
  const palette = [0xdde5db, 0xe0d2bd, 0xaac4cd, 0xe9e6da, 0xadb9ba];
  const dummy = new THREE.Object3D();
  boxes.forEach((array, i) => {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: palette[i], roughness: .85 }), array.length);
    array.forEach((b, n) => {
      dummy.position.set(b.x, b.y + b.height / 2, b.z);
      dummy.scale.set(b.width, b.height, b.depth); dummy.rotation.y = rand() * .15 - .075;
      dummy.updateMatrix(); mesh.setMatrixAt(n, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true; mesh.receiveShadow = true;
    mesh.frustumCulled = false; scene.add(mesh);
  });

  // Rio landmarks are stylised 3D representations.
  const sugar = geo(-22.9487, -43.1565);
  const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 3),
    new THREE.MeshStandardMaterial({ color: 0x64766b, roughness: 1, flatShading: true }));
  rock.position.set(sugar.x, 195, sugar.z); rock.scale.set(280, 205, 280);
  rock.castShadow = true; scene.add(rock);
  const christ = geo(-22.9519, -43.2105);
  const statue = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xece9df, roughness: .84 });
  const piece = (w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), white);
    m.position.set(x, y, z); m.castShadow = true; statue.add(m);
  };
  piece(10, 8, 9, 0, 4, 0); piece(6.5, 25, 5, 0, 20, 0);
  piece(30, 4.4, 5, 0, 28, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(4.5, 12, 10), white);
  head.position.y = 36; statue.add(head);
  statue.position.set(christ.x, sampleHeight(christ.x, christ.z), christ.z);
  scene.add(statue);
  const christLabel = label(THREE, "Cristo Redentor");
  christLabel.position.set(christ.x, statue.position.y + 245, christ.z);
  scene.add(christLabel);

  // Low-cost cloud field.
  const cloudGeo = new THREE.SphereGeometry(1, 9, 7);
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, transparent: true, opacity: .83,
    depthWrite: false, roughness: 1
  });
  const clouds = new THREE.InstancedMesh(cloudGeo, cloudMat, 155);
  for (let i = 0; i < 155; i++) {
    dummy.position.set((rand() - .5) * 53000, 1250 + rand() * 2100,
      (rand() - .5) * 53000);
    dummy.scale.set(220 + rand() * 360, 50 + rand() * 90, 125 + rand() * 210);
    dummy.rotation.set(0, rand() * Math.PI, 0); dummy.updateMatrix();
    clouds.setMatrixAt(i, dummy.matrix);
  }
  clouds.instanceMatrix.needsUpdate = true; clouds.frustumCulled = false;
  scene.add(clouds);

  const sun = new THREE.DirectionalLight(0xfff1db, 2.0);
  sun.position.set(-9000, 17000, -7000);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -3000;
  sun.shadow.camera.right = sun.shadow.camera.top = 3000;
  sun.shadow.camera.far = 30000;
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xb5dcff, 0x46634d, 1.1);
  scene.add(hemi);
  scene.fog = new THREE.FogExp2(0xb2dbf0, .000021);
  scene.background = new THREE.Color(0xb2dbf0);
  function updateEnvironment(hour, weather, dt) {
    const day = clamp(Math.sin((hour - 5.5) / 13.5 * Math.PI), .05, 1);
    sun.intensity = (weather === "nublado" ? 1.15 : 2.0) * day;
    sun.position.set(-9000 * Math.cos(hour / 24 * Math.PI * 2),
      400 + day * 17000, -6500);
    hemi.intensity = .23 + day * .95;
    const sky = new THREE.Color().setRGB(
      .04 + day * .59, .07 + day * .75, .15 + day * .79
    );
    scene.background.copy(sky);
    scene.fog.color.copy(sky);
    scene.fog.density = weather === "névoa" ? .00016 :
      weather === "nublado" ? .000055 : .000021;
    cloudMat.opacity = weather === "nublado" ? .97 : .78;
    water.offset.x = (water.offset.x + dt * .00045) % 1;
    water.offset.y = (water.offset.y + dt * .00016) % 1;
    renderer.toneMappingExposure = .35 + day * .95;
  }
  function setRealTerrainEnabled(enabled) {
    // Explicitly remove invented mountains, fake skyline and fake rocks.
    // Runways and 3D labels remain geographic reference aids.
    terrain.visible = !enabled;
    beachMesh.visible = !enabled;
    rock.visible = !enabled;
    statue.visible = !enabled;
    for (const blocks of scene.children) {
      if (blocks.isInstancedMesh && boxes.some(list =>
        list.length === blocks.count)) blocks.visible = !enabled;
    }
  }
  return { sampleHeight, updateEnvironment, airports: AIRPORTS,
    landmarks: LANDMARKS, sun, cloudMat, setRealTerrainEnabled };
}
