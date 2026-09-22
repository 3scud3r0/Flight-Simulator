import test from "node:test";
import assert from "node:assert/strict";
import {planUrbanGridTile,isStreetCorridor,STREET_GRID,STREET_WIDTH}
 from "../src/urban-grid.js";
import {isAirportClear,planSceneryTile,SCENERY_CELL}
 from "../src/scenery-plan.js";
import {AETHERIA_AIRPORTS,aetheriaRegionAt}
 from "../src/aetheria-data.js";

const flat=()=>90;
const urban=()=>({biome:"megacity"});
const safe=()=>true;
const city=(ix,iz,mobile=false)=>planUrbanGridTile(ix,iz,{
 sampleHeight:flat,regionAt:urban,clearance:safe,mobile
});

test("one tile generates stable, bounded city avenues and lamps",()=>{
 const first=city(-5,-4),second=city(-5,-4);
 assert.deepEqual(first,second);
 assert.ok(first.roads.length>0);
 assert.ok(first.roads.length<=2*7*24);
 assert.ok(first.lamps.length<=first.roads.length*2);
 for(const road of first.roads){
  assert.equal(road.width,STREET_WIDTH);
  assert.ok(["x","z"].includes(road.axis));
  assert.ok(Number.isFinite(road.y));
  assert.ok(road.length>0&&road.length<=200);
  assert.ok(road.x>=-5*SCENERY_CELL&&
   road.x<(-5+1)*SCENERY_CELL);
  assert.ok(road.z>=-4*SCENERY_CELL&&
   road.z<(-4+1)*SCENERY_CELL);
  assert.ok(road.axis==="x"?
   road.z/STREET_GRID===Math.round(road.z/STREET_GRID):
   road.x/STREET_GRID===Math.round(road.x/STREET_GRID));
 }
 for(const lamp of first.lamps){
  assert.ok(lamp.height>0&&Number.isFinite(lamp.y));
 }
});

test("neighbor tiles do not duplicate road sections or streetlights",()=>{
 const tiles=[city(-5,-4),city(-4,-4),city(-5,-3),city(-4,-3)];
 for(const key of ["roads","lamps"]){
  const keys=new Set();
  for(const tile of tiles)for(const item of tile[key]){
   const id=item.x+":"+item.z+":"+(item.axis||"lamp");
   assert.ok(!keys.has(id),id);
   keys.add(id);
  }
 }
});

test("roads, lamp posts and buildings respect airport clearances",()=>{
 const regionAt=aetheriaRegionAt;
 for(const [ix,iz] of [[-6,-4],[-5,-4],[-4,-4],[-5,-3]]){
  const tile=planSceneryTile(ix,iz,{sampleHeight:flat});
  for(const road of tile.roads){
   assert.ok(isAirportClear(road.x,road.z));
   assert.ok(isAirportClear(
    road.x+(road.axis==="x"?road.length/2:0),
    road.z+(road.axis==="z"?road.length/2:0)));
  }
  for(const lamp of tile.lamps){
   assert.ok(isAirportClear(lamp.x,lamp.z));
  }
  for(const tree of tile.trees){
   if(aetheriaRegionAt(ix*SCENERY_CELL+1200,
    iz*SCENERY_CELL+1200).biome==="megacity")
    assert.equal(isStreetCorridor(tree.x,tree.z),false);
  }
 }
 for(const airport of AETHERIA_AIRPORTS)
  assert.equal(isAirportClear(airport.x,airport.z),false);
});

test("urban roads stay out of water and steep terrain",()=>{
 assert.deepEqual(planUrbanGridTile(-5,-4,{
  sampleHeight:()=>-1,regionAt:urban,clearance:safe
 }),{roads:[],lamps:[]});
 assert.deepEqual(planUrbanGridTile(-5,-4,{
  sampleHeight:(x,z)=>x*.2+z*.1,
  regionAt:urban,clearance:safe
 }),{roads:[],lamps:[]});
 assert.deepEqual(planUrbanGridTile(4,4,{
  sampleHeight:flat,regionAt:()=>({biome:"jungle"}),
  clearance:safe
 }),{roads:[],lamps:[]});
});

test("city rendering budgets reduce road density on mobile",()=>{
 const desktop=city(-5,-4),mobile=city(-5,-4,true);
 assert.ok(mobile.roads.length<=desktop.roads.length);
 assert.ok(mobile.lamps.length<=desktop.lamps.length);
 assert.ok(desktop.roads.length>mobile.roads.length);
 assert.throws(()=>planUrbanGridTile(.25,0,{
  sampleHeight:flat,regionAt:urban,clearance:safe
 }),RangeError);
});

test("road corridor membership handles negative world coordinates",()=>{
 assert.equal(isStreetCorridor(0,900),true);
 assert.equal(isStreetCorridor(-360,900),true);
 assert.equal(isStreetCorridor(-180,-180),false);
 assert.equal(isStreetCorridor(-350,-180),true);
});
