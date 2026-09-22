import test from "node:test";
import assert from "node:assert/strict";
import {
  decodeTerrarium, lonToTile, latToTile, tileToLon, tileToLat,
  tileIndices, bilinear, terrainTileURL, imageTileURL
} from "../src/legacy/real-terrain.js";
import { isa, solarPosition, windAt } from "../src/atmosphere.js";
import {
  qNormalize,qFromEuler,qRotate,qInverseRotate,
  createRigidFlight,stepRigidFlight
} from "../src/six-dof.js";
import { createFlight, AIRCRAFT } from "../src/physics.js";

test("Terrarium RGB decoding returns sea level and fractional metres", () => {
  assert.equal(decodeTerrarium(128,0,0),0);
  assert.equal(decodeTerrarium(128,1,128),1.5);
  assert.equal(decodeTerrarium(127,255,0),-1);
});
test("Web Mercator round trips Rio coordinates", () => {
  const lat=-22.93,lon=-43.21;
  for(const z of [0,4,9,12,15]){
    assert.ok(Math.abs(tileToLat(latToTile(lat,z),z)-lat)<1e-9);
    assert.ok(Math.abs(tileToLon(lonToTile(lon,z),z)-lon)<1e-9);
  }
  assert.deepEqual(tileIndices(0,0,1),{x:1,y:1,z:1});
});
test("bilinear sampling is continuous and respects grid edges", () => {
  const grid=new Float32Array([0,10,20,30]);
  assert.equal(bilinear(grid,2,0,0),0);
  assert.equal(bilinear(grid,2,1,1),30);
  assert.equal(bilinear(grid,2,.5,.5),15);
});
test("data providers use explicitly attributed public dataset and user key", () => {
  assert.match(terrainTileURL(12,100,200),/terrarium\/12\/100\/200.png/);
  assert.match(imageTileURL(12,100,200),/s2cloudless-2024/);
  assert.throws(()=>imageTileURL(12,100,200,"maptiler"),/API key/);
  assert.match(imageTileURL(12,100,200,"maptiler","demo key"),/key=demo%20key/);
});
test("ISA pressure, density and speed of sound decrease with altitude", () => {
  const sea=isa(0), high=isa(11000);
  assert.ok(Math.abs(sea.density-1.225)<.002);
  assert.ok(high.pressurePa<sea.pressurePa);
  assert.ok(high.density<sea.density);
  assert.ok(high.speedOfSound<sea.speedOfSound);
});
test("solar ephemeris is geographically and seasonally dependent", () => {
  const midday=solarPosition(new Date("2026-09-22T15:00:00Z"),-22.93,-43.21);
  const midnight=solarPosition(new Date("2026-09-22T03:00:00Z"),-22.93,-43.21);
  assert.ok(midday.elevationDeg>30);
  assert.ok(midnight.elevationDeg<0);
  assert.ok(Math.abs(Math.hypot(midday.vector.x,midday.vector.y,
    midday.vector.z)-1)<1e-9);
});
test("wind is deterministic and stronger during windy preset", () => {
  assert.deepEqual(windAt(1000,10,"vento"),windAt(1000,10,"vento"));
  assert.ok(windAt(1000,10,"vento").turbulence>
    windAt(1000,10,"limpo").turbulence);
});
test("quaternion rotations preserve lengths and inverses", () => {
  const q=qFromEuler(1.1,.2,-.3);
  const v={x:2,y:1,z:-5};
  const rotated=qRotate(q,v),roundTrip=qInverseRotate(q,rotated);
  for(const k of ["x","y","z"])assert.ok(Math.abs(v[k]-roundTrip[k])<1e-9);
  const normal=qNormalize({w:2,x:2,y:2,z:2});
  assert.ok(Math.abs(normal.w*.5- .25)<1e-12);
});
test("six DOF starts aligned with its initial heading", () => {
  const flight=createRigidFlight(createFlight("cessna",{heading:Math.PI/2}));
  assert.ok(flight.vx>50);
  assert.ok(Math.abs(flight.vz)<.001);
  assert.equal(flight.omega.x,0);
});
test("six DOF integrates finite states and respects contact boundary", () => {
  const flight=createRigidFlight(createFlight("cessna",{y:900,speed:55}));
  for(let i=0;i<1000;i++)stepRigidFlight(flight,{
    elevator:i<240?.19:0,aileron:.03,windX:2},1/60,0);
  for(const v of [flight.x,flight.y,flight.z,flight.vx,
    flight.speed,flight.heading,flight.roll,flight.ias,flight.mach])
    assert.ok(Number.isFinite(v));
  assert.ok(flight.y>=AIRCRAFT.cessna.clearance);
});
test("optional arcade thrust does not change six DOF normal mode", () => {
  const ordinary=createRigidFlight(createFlight("cessna",{y:900,speed:55}));
  const arcade=createRigidFlight(createFlight("cessna",{y:900,speed:55}));
  for(let i=0;i<60;i++){
    stepRigidFlight(ordinary,{},1/60,0);
    stepRigidFlight(arcade,{boostAcceleration:12},1/60,0);
  }
  assert.ok(arcade.speed>ordinary.speed);
});
