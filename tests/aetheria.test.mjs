import test from "node:test";
import assert from "node:assert/strict";
import {
 AETHERIA_REGIONS,AETHERIA_AIRPORTS,AETHERIA_LANDMARKS,
 AETHERIA_SIZE,aetheriaRegionAt,aetheriaAirportById,
 aetheriaNearestAirport
} from "../src/legacy/aetheria-data.js";
import {aetheriaBiome,sampleAetheriaHeight,aetheriaWeatherAt}
 from "../src/legacy/aetheria.js";
import {createCourse,createChallenge,RING_COUNT} from "../src/challenge.js";

test("compact Aetheria has four actually designed destinations",()=>{
 assert.deepEqual(AETHERIA_SIZE,{width:48000,height:36000});
 assert.equal(AETHERIA_REGIONS.length,4);
 assert.equal(AETHERIA_AIRPORTS.length,4);
 assert.equal(AETHERIA_LANDMARKS.length,4);
 assert.deepEqual(AETHERIA_AIRPORTS.map(a=>a.id),
  ["AE-01","AE-02","AE-03","AE-04"]);
 assert.equal(new Set(AETHERIA_REGIONS.map(r=>r.id)).size,4);
 assert.ok(AETHERIA_AIRPORTS.every(a=>!a.id.startsWith("SB")));
 assert.ok(AETHERIA_AIRPORTS.every(a=>
  Math.abs(a.x)<AETHERIA_SIZE.width/2&&
  Math.abs(a.z)<AETHERIA_SIZE.height/2));
});
test("one airport per meaningful biome with its own runway",()=>{
 for(const r of AETHERIA_REGIONS){
  const airports=AETHERIA_AIRPORTS.filter(a=>a.regionId===r.id);
  assert.equal(airports.length,1,r.name);
  assert.equal(AETHERIA_LANDMARKS.filter(p=>p.regionId===r.id).length,1);
  for(const airport of airports){
   assert.ok(airport.runways[0].length>=1100);
   assert.ok(airport.runways[0].width>=28);
   assert.equal(airport.lat,airport.z);
   assert.equal(airport.lon,airport.x);
   assert.equal(aetheriaAirportById(airport.id),airport);
   assert.equal(aetheriaRegionAt(airport.x,airport.z).id,r.id);
   assert.equal(aetheriaNearestAirport(airport.x,airport.z).id,airport.id);
  }
 }
});
test("runway centre AND both ends are level on collision terrain",()=>{
 for(const a of AETHERIA_AIRPORTS){
  const theta=a.heading*Math.PI/180,half=a.runways[0].length/2;
  for(const distance of [-half,0,half])
   for(const lateral of [-a.runways[0].width/2,0,
    a.runways[0].width/2]){
    const x=a.x+Math.sin(theta)*distance+Math.cos(theta)*lateral;
    const z=a.z-Math.cos(theta)*distance+Math.sin(theta)*lateral;
    assert.ok(Math.abs(sampleAetheriaHeight(x,z)-
      (a.elevation-1))<1e-6,a.id+" runway must touch ground");
   }
 }
});
test("biomes and terrain are continuous/finite across compact world",()=>{
 for(let x=-24000;x<=24000;x+=1200)
 for(let z=-18000;z<=18000;z+=1200){
  const h=sampleAetheriaHeight(x,z);
  assert.ok(Number.isFinite(h));
  assert.ok(h>=-250&&h<=5200);
  const biome=aetheriaBiome(x,z);
  assert.ok(biome.primary&&biome.secondary);
  assert.ok(biome.blend>=0&&biome.blend<=1);
 }
});
test("terrain generation repeats the same sample exactly",()=>{
 const first=sampleAetheriaHeight(4011,-9874);
 assert.equal(first,sampleAetheriaHeight(4011,-9874));
});
test("winds are finite and reproducible across 4 regions",()=>{
 for(const r of AETHERIA_REGIONS){
  const weather=aetheriaWeatherAt(r.x,r.z,100,"vento");
  assert.ok(Number.isFinite(weather.wind.x));
  assert.ok(Number.isFinite(weather.wind.y));
  assert.ok(Number.isFinite(weather.wind.z));
  assert.ok(weather.visibilityMeters>0);
  assert.deepEqual(weather,aetheriaWeatherAt(r.x,r.z,100,"vento"));
 }
});
test("challenge course clears the compact terrain",()=>{
 for(const a of AETHERIA_AIRPORTS){
  const plane={x:a.x,y:a.elevation+900,z:a.z,heading:0,speed:70};
  const rings=createCourse(plane,sampleAetheriaHeight);
  const challenge=createChallenge(rings);
  assert.equal(challenge.rings.length,RING_COUNT);
  for(const ring of rings)assert.ok(
    ring.y>sampleAetheriaHeight(ring.x,ring.z)+50);
 }
});
test("Rio coordinates never leak into the fictional atlas",()=>{
 assert.equal(aetheriaAirportById("AE-04").name,"Clareira Virídia");
 assert.equal(aetheriaAirportById("SBGL").id,"AE-01");
});
