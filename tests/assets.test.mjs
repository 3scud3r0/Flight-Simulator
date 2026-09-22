import test from "node:test";
import assert from "node:assert/strict";
import {KENNEY_COMMIT,KENNEY_FILES,KENNEY_MODELS,
 POLY_HAVEN_MATERIALS} from "../src/asset-manifest.js";
import {planAirportAssets} from "../src/asset-library.js";
import {AETHERIA_REGIONS,AETHERIA_AIRPORTS}
 from "../src/legacy/aetheria-data.js";
test("50 SHA-pinned imported original CC0 glTF models",()=>{
 assert.equal(KENNEY_MODELS.length,50);
 assert.equal(new Set(KENNEY_MODELS).size,50);
 assert.match(KENNEY_COMMIT,/^[0-9a-f]{40}$/);
 assert.equal(KENNEY_FILES.filter(f=>f.path.endsWith(".glb")).length,50);
 assert.ok(KENNEY_FILES.some(f=>f.path.endsWith("Textures/colormap.png")));
 for(const file of KENNEY_FILES){
  assert.match(file.sha,/^[0-9a-f]{40}$/);
  assert.ok(file.size>300);
  assert.match(file.path,/^3d\/[\w-]+\//);
 }
 assert.equal(new Set(POLY_HAVEN_MATERIALS).size,4);
});
test("all four detailed airports receive deterministic real CC0 model plans",()=>{
 for(const airport of AETHERIA_AIRPORTS){
  const region=AETHERIA_REGIONS.find(x=>x.id===airport.regionId);
  const first=planAirportAssets(airport,region);
  assert.ok(first.length>=10,airport.id);
  assert.deepEqual(first,planAirportAssets(airport,region));
  for(const item of first){
   assert.ok(KENNEY_MODELS.includes(item.key));
   assert.ok(Number.isFinite(item.x)&&Number.isFinite(item.z));
   assert.ok(item.height>0&&item.width>0);
  }
 }
});
test("light variant has lower world detail budget",()=>{
 const airport=AETHERIA_AIRPORTS[0];
 const region=AETHERIA_REGIONS.find(x=>x.id===airport.regionId);
 const full=planAirportAssets(airport,region);
 const lite=planAirportAssets(airport,region,{mobile:true});
 assert.ok(full.length>lite.length);
});
