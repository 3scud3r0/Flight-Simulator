import test from "node:test";
import assert from "node:assert/strict";
import {
 SCENERY_CELL,spatialHash,isAirportClear,planSceneryTile
} from "../src/scenery-plan.js";
import {terrainSubdivisions} from "../src/terrain-detail.js";
import {AETHERIA_AIRPORTS} from "../src/aetheria-data.js";
import {sampleAetheriaHeight} from "../src/aetheria.js";

const flat=()=>90;
test("tile scenery is deterministic and bounded",()=>{
 const first=planSceneryTile(-5,-4,{sampleHeight:flat});
 const second=planSceneryTile(-5,-4,{sampleHeight:flat});
 assert.deepEqual(first,second);
 assert.ok(first.buildings.length>0,"Nova Iris needs a skyline");
 assert.ok(first.buildings.length<300);
 assert.ok(first.trees.length<=210);
 assert.ok(first.rocks.length<=28);
 assert.ok(first.buildings.every(item=>
  item.height>0&&item.width>0&&item.depth>0));
 assert.ok(first.trees.every(item=>item.height>0&&item.radius>0));
});

test("scene locations remain inside their own tile, above water and off runways",()=>{
 for(const [ix,iz] of [[-5,-4],[4,-4],[-5,4],[4,4]]){
  const tile=planSceneryTile(ix,iz,{sampleHeight:flat});
  for(const item of [...tile.buildings,...tile.trees,...tile.rocks]){
   assert.ok(item.x>=ix*SCENERY_CELL&&
    item.x<(ix+1)*SCENERY_CELL);
   assert.ok(item.z>=iz*SCENERY_CELL&&
    item.z<(iz+1)*SCENERY_CELL);
   assert.ok(isAirportClear(item.x,item.z));
   assert.equal(item.y,90);
  }
 }
 for(const airport of AETHERIA_AIRPORTS)
  assert.equal(isAirportClear(airport.x,airport.z),false);
});

test("adjacent city tiles never create duplicate global lots",()=>{
 const left=planSceneryTile(-5,-4,{sampleHeight:flat});
 const right=planSceneryTile(-4,-4,{sampleHeight:flat});
 const keys=new Set();
 for(const building of [...left.buildings,...right.buildings]){
  const key=building.x+":"+building.z;
  assert.equal(keys.has(key),false,key);
  keys.add(key);
 }
});

test("mobile density is bounded below full detail",()=>{
 for(const [ix,iz] of [[-5,-4],[4,-4],[-5,4],[4,4]]){
  const full=planSceneryTile(ix,iz,{sampleHeight:flat});
  const mobile=planSceneryTile(ix,iz,{sampleHeight:flat,mobile:true});
  assert.ok(mobile.buildings.length<=full.buildings.length);
  assert.ok(mobile.trees.length<=full.trees.length);
  assert.ok(mobile.rocks.length<=full.rocks.length);
 }
 assert.deepEqual(planSceneryTile(-5,-4,{
  sampleHeight:flat,compatibility:true
 }),{buildings:[],trees:[],rocks:[]});
});

test("scenery planner excludes water without disabling terrain collision",()=>{
 const underwater=planSceneryTile(-5,-4,{sampleHeight:()=>-8});
 assert.equal(underwater.buildings.length,0);
 assert.equal(underwater.trees.length,0);
 assert.equal(underwater.rocks.length,0);
 const real=planSceneryTile(-5,-4,{
  sampleHeight:sampleAetheriaHeight,mobile:true
 });
 assert.ok(real.buildings.every(x=>Number.isFinite(x.y)&&x.y>2));
});

test("terrain LOD is concentric and preserves the compatibility renderer",()=>{
 assert.equal(terrainSubdivisions(0,0),96);
 assert.equal(terrainSubdivisions(1,0),48);
 assert.equal(terrainSubdivisions(2,-2),20);
 assert.equal(terrainSubdivisions(0,0,{mobile:true}),32);
 assert.equal(terrainSubdivisions(1,0,{mobile:true}),16);
 assert.equal(terrainSubdivisions(0,0,{compatibility:true}),14);
 assert.equal(terrainSubdivisions(2,2,{compatibility:true}),14);
 assert.throws(()=>terrainSubdivisions(.5,0),RangeError);
});

test("spatial hashing is deterministic and returns unit-interval numbers",()=>{
 for(let x=-100;x<=100;x+=5){
  const hash=spatialHash(x,x*3,17);
  assert.ok(hash>=0&&hash<1);
  assert.equal(hash,spatialHash(x,x*3,17));
 }
 assert.notEqual(spatialHash(1,2,3),spatialHash(2,1,3));
});
