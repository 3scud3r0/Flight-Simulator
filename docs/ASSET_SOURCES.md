# Asset provenance and honest visual target

The Flight Simulator project code remains MIT. These external **assets are CC0 and are not owned by this project**. Keeping this manifest is useful for future changes even though CC0 attribution is optional.

## 50 actual imported glTF binary models

**Origin:** Kenney, Nature Kit, City Commercial, City Industrial, City Suburban, City Roads and Space Kit, mirrored at `shorepine/kenney`.

- Official author/license: https://kenney.nl/ (individual pack metadata; Nature Kit: https://kenney.nl/assets/nature-kit).
- Model mirror: https://github.com/shorepine/kenney
- Pinned source commit: `3694c6879e487c108f55677be7dd2ca75b07cc3b`.
- Exact 50 model paths, four required adjacent colormaps, original byte sizes and Git blob hashes: [src/asset-manifest.js](../src/asset-manifest.js).
- **License:** CC0 1.0; no GPL scenes or commercial flight-simulator game assets are copied.

The build downloads these individual models directly from pinned public paths, verifies the `git hash-object` format (SHA-1 of `blob <size>\\0<bytes>`) against the published Git tree, checks GLB headers, and publishes `assets/kenney/<pack>/<model>.glb`. Files are not loaded from third-party CDNs in the player's browser; they are included in the deployed site. We deliberately avoid committing duplicate large binary files to the source repository.

## Four Poly Haven terrain surfaces

- Official material source/license: https://polyhaven.com/license (CC0).
- Direct material pages: https://polyhaven.com/a/gravel_ground_01 ; https://polyhaven.com/a/rocks_ground_06 ; https://polyhaven.com/a/aerial_beach_01 ; https://polyhaven.com/a/aerial_asphalt_01
- 1k local albedo files, and normal maps for gravel, rock and asphalt where available, are copied to `assets/pbr/` during build from the public Poly Haven asset CDN; no API token required. If one optional material is unavailable, the procedural fallback remains and the build reports a warning. No thumbnails, logos, or website graphics are copied.
- Four albedo images feed terrain materials per biome; the asphalt material is used for runway asphalt. The original per-vertex biome tint remains, as does the deterministic CPU height sampler.

## Rendering and performance

- **Aetheria completa:** GLTFLoader loads and caches relevant CC0 models only when an airport is near; a plan selects hangars, rocks, region-specific buildings and trees. At least twelve true GLB instances must be present before the full-mode CI flight screenshot is taken.
- **Aetheria leve:** remains separate and has a small built-in world; no GLB download, PBR load, satellite imagery or optional full-module dependency.
- **Rio:** unchanged as its own menu option, with the original DEM/imagery settings.
- The megamap still contains author-authored *procedural* airports, not sixty painstakingly art-directed handcrafted airports. The Kenney geometry is **stylized**, not photoreal AAA. We are not presenting a low-poly GLB kit or PBR alone as a substitute for AAA-scale environmental art.
- Real device FPS varies substantially; headless Chromium may use CPU-based SwiftShader, and its frame rate is not representative of every GPU.

## Reproducing the binary asset build

The GitHub Actions deployment downloads and caches the selected CC0 files when publishing.

```bash
npm install --no-save --no-package-lock three@0.180.0 playwright@1.55.0 esbuild@0.25.9
mkdir -p vendor
cp node_modules/three/build/three.module.js vendor/
cp node_modules/three/build/three.core.js vendor/
npx esbuild node_modules/three/examples/jsm/loaders/GLTFLoader.js --bundle --format=esm --external:three --outfile=vendor/GLTFLoader.bundle.js
npm run assets:fetch
npm run check
npm test
```

The imported files are staged inside `assets/` **in the deployment**, not magically downloaded by `git clone`. They are not transcluded into `src/aetheria.js`. Site copies have `assets/asset-report.json` with build counts. To inspect the actual rendered result, see `proof/aetheria-full.png` and `proof/aetheria-flight.webm` from the latest GitHub Actions artifacts, not marketing mock-ups.

## Restriction

An open and non-commercial repository still needs permission for each resource. Game-specific scenery from other publishers is **not** imported unless its individual license permits redistribution and adaptation. Keeping original provenance and avoiding GPL/copyleft surprises is part of making this project maintainable.
