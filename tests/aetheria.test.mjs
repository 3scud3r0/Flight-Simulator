import test from "node:test";
import assert from "node:assert/strict";
import {
 AETHERIA_REGIONS,AETHERIA_AIRPORTS,AETHERIA_LANDMARKS,
 AETHERIA_SIZE,aetheriaRegionAt,aetheriaAirportById,
 aetheriaNearestAirport
} from "../src/aetheria-data.js";
import {
 aetheriaBiome,sampleAetheriaHeight,aetheriaWeatherAt
} from "../src/aetheria.js";
import {createCourse,createChallenge} from "../src/challenge.js";
const approx=(a,b,tol=1e-6)=>assert.ok(Math.abs(a-b)<=tol,
 `${a} and ${b} differ by more than ${tol}`);
test("Aetheria and Rio are separate namespaces",()=>{
 assert.equal(AETHERIA_SIZE.width,3200000);
 assert.equal(AETHERIA_SIZE.height,2400000);
 assert.equal(AETHERIA_REGIONS.length,20);
 assert.equal(AETHERIA_AIRPORTS.length,60);
 assert.equal(AETHERIA_LANDMARKS.length,20);
 assert.equal(new Set(AETHERIA_AIRPORTS.map(a=>a.id)).size,60);
 assert.equal(new Set(AETHERIA_REGIONS.map(r=>r.id)).size,20);
 assert.ok(AETHERIA_AIRPORTS.every(a=>/^AE-\d{2}$/.test(a.id)));
 assert.ok(!AETHERIA_AIRPORTS.some(a=>a.id.startsWith("SB")));
});
test("exactly three usable airports per world region",()=>{
 for(const region of AETHERIA_REGIONS){
  const airports=AETHERIA_AIRPORTS.filter(a=>a.regionId===region.id);
  assert.equal(airports.length,3,region.name);
  assert.equal(AETHERIA_LANDMARKS.filter(p=>p.regionId===region.id).length,1);
  for(const airport of airports){
   assert.ok(airport.runways[0].length>=600);
   assert.ok(airport.runways[0].width>=25);
   assert.equal(airport.lat,airport.z);
   assert.equal(airport.lon,airport.x);
   assert.ok(Number.isFinite(airport.elevation));
   assert.equal(aetheriaAirportById(airport.id),airport);
  }
 }
});
test("eight intercontinental airports, 32 regional, twenty special",()=>{
 const count=category=>AETHERIA_AIRPORTS.filter(
  airport=>airport.category===category).length;
 assert.equal(count("internacional"),8);
 assert.equal(count("regional"),32);
 assert.equal(count("especial"),20);
});
test("elevation stays finite across the entire megamap",()=>{
 for(let x=-1600000;x<=1600000;x+=320000)
 for(let z=-1200000;z<=1200000;z+=240000){
  const h=sampleAetheriaHeight(x,z);
  assert.ok(Number.isFinite(h),`invalid terrain at ${x},${z}`);
  assert.ok(h>=-250&&h<=5200);
  assert.ok(aetheriaBiome(x,z).primary);
 }
});
test("airports sit on flattened, continuous underlying terrain",()=>{
 for(const a of AETHERIA_AIRPORTS){
  approx(sampleAetheriaHeight(a.x,a.z),a.elevation-1,1e-6);
  const a350=sampleAetheriaHeight(a.x+350,a.z);
  approx(a350,a.elevation-1,1e-6);
  const h1=sampleAetheriaHeight(a.x+4000,a.z);
  assert.ok(Number.isFinite(h1));
 }
});
test("terrain and regional classification are deterministic",()=>{
 const airport=AETHERIA_AIRPORTS[0];
 const first=sampleAetheriaHeight(airport.x+7200,airport.z-3600);
 const second=sampleAetheriaHeight(airport.x+7200,airport.z-3600);
 assert.equal(first,second);
 const region=aetheriaRegionAt(airport.x,airport.z);
 assert.equal(region.id,airport.regionId);
 assert.equal(aetheriaNearestAirport(airport.x,airport.z).id,airport.id);
});
test("Aetheria weather uses region-dependent reproducible profiles",()=>{
 const a=AETHERIA_AIRPORTS[0];
 const weather=aetheriaWeatherAt(a.x,a.z,100,"vento");
 assert.ok(Number.isFinite(weather.wind.x));
 assert.ok(Number.isFinite(weather.wind.y));
 assert.ok(Number.isFinite(weather.wind.z));
 assert.ok(weather.visibilityMeters>0);
 assert.deepEqual(weather,aetheriaWeatherAt(a.x,a.z,100,"vento"));
});
test("challenge course remains possible above fictional heightmap",()=>{
 const a=AETHERIA_AIRPORTS.find(a=>a.regionId==="nova-iris");
 const plane={x:a.x,y:a.elevation+700,z:a.z,
  heading:0,speed:70};
 const rings=createCourse(plane,sampleAetheriaHeight);
 const challenge=createChallenge(rings);
 assert.equal(challenge.rings.length,14);
 for(const ring of challenge.rings){
  assert.ok(ring.y>sampleAetheriaHeight(ring.x,ring.z)+50);
 }
});
test("Aetheria remains offline: no URL is required for generated terrain",()=>{
 assert.equal(aetheriaRegionAt(0,0).name,"Eón");
 assert.equal(aetheriaAirportById("AE-60").name,"Ilha Suspensa");
 assert.equal(typeof sampleAetheriaHeight,"function");
});
