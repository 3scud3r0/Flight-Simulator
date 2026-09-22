/**
 * Streaming real Rio terrain: Mapzen/Tilezen Terrarium tiles on AWS Open Data.
 * Satellite textures: EOx Sentinel-2 Cloudless 2024 (CC BY-NC-SA 4.0).
 * NO aerial assets are copied or cached into this repository.
 * All elevations are approximate geoid-relative metres, not certified AGL.
 */
import { geo, toGeo, sampleHeight as legacyHeight } from "./world.js";

export const DEM_SOURCE = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium";
export const IMAGERY_SOURCE =
  "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/GoogleMapsCompatible";
export const DEM_ZOOM = 12;
export const MERCATOR_MAX = 85.05112878;

export function lonToTile(lon, zoom) {
  return ((lon + 180) / 360) * 2 ** zoom;
}
export function latToTile(lat, zoom) {
  const r = Math.max(-MERCATOR_MAX, Math.min(MERCATOR_MAX, lat)) * Math.PI / 180;
  return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** zoom;
}
export function tileToLon(x, zoom) {
  return x / 2 ** zoom * 360 - 180;
}
export function tileToLat(y, zoom) {
  return Math.atan(Math.sinh(Math.PI * (1 - 2 * y / 2 ** zoom))) * 180 / Math.PI;
}
export function decodeTerrarium(red, green, blue) {
  return red * 256 + green + blue / 256 - 32768;
}
export function tileIndices(lat, lon, zoom = DEM_ZOOM) {
  return { x: Math.floor(lonToTile(lon, zoom)),
    y: Math.floor(latToTile(lat, zoom)), z: zoom };
}
export function imageTileURL(z, x, y, provider = "eox", apiKey = "") {
  if (provider === "maptiler") {
    if (!apiKey) throw new Error("MapTiler requires a user-supplied API key");
    return `https://api.maptiler.com/tiles/satellite-v4/${z}/${x}/${y}?key=${encodeURIComponent(apiKey)}`;
  }
  return `${IMAGERY_SOURCE}/${z}/${y}/${x}.jpg`;
}
export function terrainTileURL(z, x, y) {
  return `${DEM_SOURCE}/${z}/${x}/${y}.png`;
}
export function bilinear(grid, size, u, v) {
  const x = Math.max(0, Math.min(size - 1, u * (size - 1)));
  const y = Math.max(0, Math.min(size - 1, v * (size - 1)));
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(size - 1, x0 + 1), y1 = Math.min(size - 1, y0 + 1);
  const fx = x - x0, fy = y - y0;
  return (grid[y0 * size + x0] * (1 - fx) +
    grid[y0 * size + x1] * fx) * (1 - fy) +
    (grid[y1 * size + x0] * (1 - fx) +
    grid[y1 * size + x1] * fx) * fy;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Tile unavailable: " + url.split("?")[0]));
    image.src = url;
  });
}

export function createRealTerrain(THREE, scene, opts = {}) {
  const mobile = opts.mobile ?? matchMedia("(pointer: coarse)").matches;
  const zoom = opts.zoom ?? DEM_ZOOM;
  const radius = opts.radius ?? (mobile ? 1 : 2);
  const limit = opts.limit ?? (mobile ? 2 : 4);
  const maxTiles = (2 * radius + 1) ** 2 + 6;
  const provider = opts.provider ?? "eox";
  const apiKey = opts.apiKey ?? "";
  const tiles = new Map(), failures = new Set();
  const queue = [];
  const group = new THREE.Group();
  group.name = "RealElevations_Streaming";
  scene.add(group);
  let active = 0, disposed = false, complete = 0;
  let status = "Carregando elevação real do Rio…";
  const onStatus = opts.onStatus || (() => {});
  const onReady = opts.onReady || (() => {});
  const onFirstTile = opts.onFirstTile || (() => {});
  let notifiedFirst = false;
  let tick = 0;

  function valueFromImage(image) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas 2D unavailable");
    ctx.drawImage(image, 0, 0, 256, 256);
    const pixels = ctx.getImageData(0, 0, 256, 256).data;
    const heights = new Float32Array(256 * 256);
    for (let i = 0; i < heights.length; i++) {
      const p = i * 4;
      heights[i] = Math.max(-200, Math.min(4000, decodeTerrarium(
        pixels[p], pixels[p + 1], pixels[p + 2])));
    }
    return heights;
  }

  function makeGeometry(z, x, y, heights) {
    // Geographic vertices are calculated directly, avoiding tile edge drift.
    // 256 DEM texels are sampled bilinearly across a 48×48 mesh.
    const N = mobile ? 24 : 48;
    const positions = new Float32Array((N + 1) ** 2 * 3);
    const uv = new Float32Array((N + 1) ** 2 * 2);
    const indices = [];
    for (let row = 0; row <= N; row++) for (let col = 0; col <= N; col++) {
      const u = col / N, v = row / N;
      const world = geo(tileToLat(y + v, z), tileToLon(x + u, z));
      const i = row * (N + 1) + col;
      positions[i * 3] = world.x;
      positions[i * 3 + 1] = Math.max(0, bilinear(heights, 256, u, v));
      positions[i * 3 + 2] = world.z;
      uv[i * 2] = u;
      uv[i * 2 + 1] = 1 - v;
      if (row < N && col < N) {
        const a = i, b = i + 1, c = i + N + 1, d = c + 1;
        // Winding follows -Z toward geographic north.
        indices.push(a, c, b, b, c, d);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  function getHeight(x, z) {
    const { lat, lon } = toGeo(x, z);
    const tx = lonToTile(lon, zoom), ty = latToTile(lat, zoom);
    const ix = Math.floor(tx), iy = Math.floor(ty);
    const tile = tiles.get(`${zoom}/${ix}/${iy}`);
    if (tile?.heights) {
      return Math.max(0, bilinear(tile.heights, 256, tx - ix, ty - iy));
    }
    // A loaded lower-resolution or remote map must NEVER be passed off as
    // surveyed elevation; signal failure so the caller may use its fallback.
    return null;
  }

  function schedule(z, x, y) {
    if (disposed) return;
    const key = `${z}/${x}/${y}`;
    if (tiles.has(key) || failures.has(key)) return;
    const record = { key, x, y, z, heights: null, mesh: null, texture: null };
    tiles.set(key, record);
    queue.push(record);
    pump();
  }

  async function process(record) {
    try {
      const image = await loadImage(terrainTileURL(record.z, record.x, record.y));
      if (disposed || !tiles.has(record.key)) return;
      record.heights = valueFromImage(image);
      const geometry = makeGeometry(record.z, record.x, record.y, record.heights);
      const material = new THREE.MeshStandardMaterial({
        color: 0xffffff, roughness: .97, metalness: 0,
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.receiveShadow = true;
      record.mesh = mesh;
      group.add(mesh);
      complete++;
      if (!notifiedFirst) { notifiedFirst = true; onFirstTile(); }
      status = `Terreno real: ${complete} blocos carregados`;
      onStatus(status);
      onReady(record);
      if (opts.imagery !== false) {
        try {
          const photo = await loadImage(imageTileURL(
            record.z, record.x, record.y, provider, apiKey));
          if (!disposed && tiles.has(record.key) && record.mesh) {
            const texture = new THREE.Texture(photo);
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.anisotropy = Math.min(8,
              opts.renderer?.capabilities?.getMaxAnisotropy?.() || 4);
            texture.needsUpdate = true;
            record.texture = texture;
            material.map = texture;
            material.needsUpdate = true;
          }
        } catch {
          // DEM still works if imagery is denied or the provider is offline.
          material.color.set(0x71866b);
          status = "Relevo real ativo · algumas imagens indisponíveis";
          onStatus(status);
        }
      }
    } catch {
      failures.add(record.key);
      if (tiles.has(record.key)) tiles.delete(record.key);
      status = "Alguns dados reais indisponíveis — mantendo terreno reserva";
      onStatus(status);
    }
  }

  function pump() {
    while (!disposed && active < limit && queue.length) {
      const record = queue.shift();
      if (!tiles.has(record.key)) continue;
      active++;
      process(record).finally(() => { active--; pump(); });
    }
  }
  function update(x, z) {
    if (disposed || ++tick % 150 !== 1) return;
    const { lat, lon } = toGeo(x, z);
    const center = tileIndices(lat, lon, zoom);
    const desired = [];
    for (let r = 0; r <= radius; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        desired.push({ z: zoom, x: center.x + dx, y: center.y + dy });
      }
    }
    const keep = new Set(desired.map(t => `${t.z}/${t.x}/${t.y}`));
    for (const [key, record] of tiles) {
      if (keep.has(key)) continue;
      if (!record.mesh) { tiles.delete(key); continue; }
      group.remove(record.mesh);
      record.mesh.geometry.dispose();
      record.mesh.material.dispose();
      record.texture?.dispose();
      tiles.delete(key);
    }
    // No bulk pre-fetch: only tiles in a bounded vicinity of the aircraft.
    for (const t of desired) schedule(t.z, t.x, t.y);
    pump();
  }
  function dispose() {
    disposed = true;
    queue.length = 0;
    for (const record of tiles.values()) {
      record.mesh?.geometry.dispose();
      record.mesh?.material.dispose();
      record.texture?.dispose();
    }
    tiles.clear();
    scene.remove(group);
  }
  return {
    group, tiles, update, getHeight, dispose, get status() { return status; },
    get readyCount() { return complete; }, get activeCount() { return active; }
  };
}
