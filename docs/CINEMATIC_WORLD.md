# Aetheria Cinematic World — first engine integration

This implementation is a **working architectural slice**, not an AAA-fidelity
asset pack or a claim of measured 60 FPS. It keeps Rio and the standalone
Aetheria Lite untouched, and only activates the new scene objects in the
full Aetheria renderer.

## What's now integrated

- **Three-ring visual terrain LOD:** full desktop terrain uses 96 subdivisions
  in the aircraft tile, 48 in the eight adjacent tiles, and 20 in the outer
  ring. Mobile uses 32 near / 16 farther; compatibility retains 14. Resident
  tile limits remain 25 on desktop and 9 on mobile. Only one tile is upgraded
  or generated per four update calls after the original five-tile prewarm.
- **Deterministic 2.4 km scenery plans:** Nova Íris gains a seeded urban
  lattice, with taller buildings toward its center. Jungle, tropical, alpine
  and city regions receive biome-specific foliage. Alpine/jungle terrain
  receives sparse rock placements.
- **Nova Íris road-and-light pass:** a global 360 m avenue grid is cut into
  tile-owned 100 m segments (200 m on mobile), rejecting water, excessive
  grade and runway/taxi corridors. Instanced road surfaces, lamp posts and
  unlit-by-day/emissive-by-night light bulbs provide consistent distant
  composition. Streets are visual-only, not driveable collision geometry.
- **Airport protection:** building and vegetation placements reject an
  extended runway/taxi safety envelope. Both the rendering geometry and
  collision sampler use the original world-space height function.
- **Instanced drawing:** scenery shares six geometries, seven materials and,
  where Canvas 2D is available, locally generated window/albedo textures.
  Each tile uses a few bounded GPU batches rather than one draw call per
  building or tree; its instance buffers are released on eviction.
- **Time of day:** building windows receive a bounded emissive contribution
  at night through the same daylight parameter used by the world.
- **Isolation:** no new requests to third-party map servers and no changes to
  the Rio DEM/imagery paths or the independent offline Aetheria Lite renderer.

## Architectural boundaries

`src/scenery-plan.js` is dependency-free with respect to Three.js and accepts
an injected elevation sampler. `src/scenery-renderer.js` owns only Three.js
objects. `src/terrain-detail.js` is a pure LOD policy. The adapter in
`src/aetheria.js` connects all three to the existing update and disposal
lifecycle.

**Not yet delivered:** photoreal scanned/handcrafted urban assets, organic
road-network topology and traffic, cascade shadows, volumetric clouds, sophisticated reflections,
photogrammetry, real traffic, airport-grade authored scenery, or certified
aerodynamics. Procedural box buildings and low-poly canopy geometry are an
intermediate representation. Further artistic asset and measured GPU work
are necessary before describing the rendered result as AAA.

## How to verify

```bash
npm run check
npm test
npm run test:browser
```

Browser smoke testing needs the vendored Three.js, Playwright and generated
CC0 assets described in `docs/ASSET_SOURCES.md`. On GitHub Actions, the
browser proof captures real WebGL screenshots and a flight video. Headless
software WebGL alone is not a GPU performance benchmark.

The new pure tests cover deterministic scenery, tile seams, world bounds,
airport exclusions, underwater exclusion, relative mobile budgets, terrain
LOD, street tile uniqueness and graded-road rejection. A browser evaluation is still required to validate lighting, aesthetic
quality, and actual frame times across representative GPUs.
